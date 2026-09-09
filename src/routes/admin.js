const express = require('express');
const router = express.Router();
const db = require('../db/db');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

// Multer Upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.resolve(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|mp4|pdf/i;
  const isExtValid = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const isMimeValid = /image|video|application\/pdf/i.test(file.mimetype);
  
  if (isExtValid && isMimeValid) {
    return cb(null, true);
  }
  cb(new Error('Allowed file types: images (jpg, png, webp), video (mp4), and documents (pdf).'));
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 40 * 1024 * 1024 } // 40MB limit
});

// Activity Logger helper
async function logActivity(action, details = '') {
  try {
    await db.run('INSERT INTO activity_logs (action, details) VALUES (?, ?)', [action, details]);
  } catch (err) {
    console.error('Error logging activity:', err.message);
  }
}

// ----------------------------------------------------
// PUBLIC ADMIN ROUTES (LOGIN/LOGOUT)
// ----------------------------------------------------

// Admin Login Page
router.get('/login', (req, res) => {
  const cookies = auth.parseCookies(req.headers.cookie);
  const token = cookies.admin_auth_token;
  const validUsername = auth.verifyToken(token);

  if ((req.session && req.session.isAdmin) || validUsername) {
    if (validUsername && req.session) {
      req.session.isAdmin = true;
      req.session.username = validUsername;
    }
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: null });
});

// Admin Login Handler
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await db.query('SELECT * FROM users WHERE username = ?', [username]);

    if (users.length > 0) {
      const user = users[0];
      const match = bcrypt.compareSync(password, user.password);
      if (match) {
        req.session.isAdmin = true;
        req.session.username = user.username;

        // Set persistent HTTP-only auth token for Vercel serverless session persistence
        const token = auth.generateToken(user.username);
        res.cookie('admin_auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        await logActivity('Admin Login', `User '${username}' logged in successfully.`);
        return res.redirect('/admin');
      }
    }

    res.render('admin/login', { error: 'Invalid username or password.' });
  } catch (err) {
    res.render('admin/login', { error: 'Database error: ' + err.message });
  }
});

// Admin Logout
router.get('/logout', async (req, res) => {
  const user = req.session?.username || 'unknown';
  await logActivity('Admin Logout', `User '${user}' logged out.`);
  res.clearCookie('admin_auth_token');
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// ----------------------------------------------------
// SECURE ADMIN ROUTES (AUTHENTICATED ONLY)
// ----------------------------------------------------
router.use(auth);

// Helper to inject global admin layout details
router.use(async (req, res, next) => {
  try {
    const settingsList = await db.query('SELECT * FROM settings LIMIT 1');
    res.locals.adminSettings = settingsList.length > 0 ? settingsList[0] : {};
    res.locals.adminUser = req.session.username;
  } catch (err) {
    console.error(err);
  }
  next();
});

// 1. Dashboard Landing
router.get('/', async (req, res) => {
  try {
    // Visitor counters
    const totalVisitorsRow = await db.query('SELECT COUNT(*) as count FROM analytics');
    
    // MySQL vs SQLite date extraction
    let todayVisitorsRow, monthlyVisitorsRow;
    if (db.type === 'mysql') {
      todayVisitorsRow = await db.query('SELECT COUNT(*) as count FROM analytics WHERE DATE(created_at) = CURDATE()');
      monthlyVisitorsRow = await db.query('SELECT COUNT(*) as count FROM analytics WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())');
    } else {
      todayVisitorsRow = await db.query("SELECT COUNT(*) as count FROM analytics WHERE date(created_at) = date('now')");
      monthlyVisitorsRow = await db.query("SELECT COUNT(*) as count FROM analytics WHERE strftime('%m', created_at) = strftime('%m', 'now') AND strftime('%Y', created_at) = strftime('%Y', 'now')");
    }

    const totalProjectsRow = await db.query('SELECT COUNT(*) as count FROM projects');
    const totalMessagesRow = await db.query('SELECT COUNT(*) as count FROM messages');
    const unreadMessagesRow = await db.query("SELECT COUNT(*) as count FROM messages WHERE status = 'unread'");

    // Top Pages
    const popularPages = await db.query('SELECT page, COUNT(*) as views FROM analytics GROUP BY page ORDER BY views DESC LIMIT 5');

    // Popular Projects
    const popularProjects = await db.query('SELECT id, title, category, views FROM projects ORDER BY views DESC LIMIT 5');

    // Device split
    const devices = await db.query('SELECT device, COUNT(*) as count FROM analytics GROUP BY device');

    // Traffic sources
    const sources = await db.query('SELECT source, COUNT(*) as count FROM analytics GROUP BY source ORDER BY count DESC LIMIT 5');

    // Browser metrics
    const browsers = await db.query('SELECT browser, COUNT(*) as count FROM analytics GROUP BY browser');

    // Recent Messages
    const recentMessages = await db.query('SELECT * FROM messages ORDER BY id DESC LIMIT 5');

    // Logs
    const recentLogs = await db.query('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 5');

    res.render('admin/dashboard', {
      stats: {
        totalVisitors: totalVisitorsRow[0].count,
        todayVisitors: todayVisitorsRow[0].count,
        monthlyVisitors: monthlyVisitorsRow[0].count,
        totalProjects: totalProjectsRow[0].count,
        totalMessages: totalMessagesRow[0].count,
        unreadMessages: unreadMessagesRow[0].count,
        activeVisitors: req.getActiveUsersCount()
      },
      popularPages,
      popularProjects,
      devices,
      sources,
      browsers,
      recentMessages,
      recentLogs
    });
  } catch (err) {
    res.status(500).send('Admin Dashboard Error: ' + err.message);
  }
});

// 2. Portfolio Management
router.get('/portfolio', async (req, res) => {
  try {
    const projects = await db.query('SELECT * FROM projects ORDER BY id DESC');
    res.render('admin/portfolio-manage', { projects, error: null, success: null });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Portfolio Add Project
router.post('/portfolio/add', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video_file', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, category, description, technologies, website_link, github_link, video_url, challenges, solutions, client_info } = req.body;
    
    let imagePath = '/images/placeholder.jpg';
    if (req.files && req.files['image']) {
      imagePath = '/uploads/' + req.files['image'][0].filename;
      // Add to media manager database
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.files['image'][0].filename,
        req.files['image'][0].mimetype,
        imagePath
      ]);
    }

    let finalVideo = video_url || '';
    if (req.files && req.files['video_file']) {
      finalVideo = '/uploads/' + req.files['video_file'][0].filename;
      // Add to media manager
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.files['video_file'][0].filename,
        req.files['video_file'][0].mimetype,
        finalVideo
      ]);
    }

    await db.run(`
      INSERT INTO projects (
        title, category, description, technologies, image, video, website_link, github_link, challenges, solutions, client_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        category,
        description,
        technologies,
        imagePath,
        finalVideo,
        website_link || '',
        github_link || '',
        challenges || '',
        solutions || '',
        client_info || ''
      ]
    );

    await logActivity('Portfolio Create', `Added project: "${title}"`);
    res.redirect('/admin/portfolio');
  } catch (err) {
    res.status(500).send('Error adding project: ' + err.message);
  }
});

// Portfolio Update Project
router.post('/portfolio/edit/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video_file', maxCount: 1 }]), async (req, res) => {
  try {
    const projectId = req.params.id;
    const { title, category, description, technologies, website_link, github_link, video_url, challenges, solutions, client_info } = req.body;
    
    const existing = await db.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (existing.length === 0) {
      return res.status(404).send('Project not found');
    }

    let imagePath = existing[0].image;
    if (req.files && req.files['image']) {
      imagePath = '/uploads/' + req.files['image'][0].filename;
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.files['image'][0].filename,
        req.files['image'][0].mimetype,
        imagePath
      ]);
    }

    let finalVideo = video_url || existing[0].video;
    if (req.files && req.files['video_file']) {
      finalVideo = '/uploads/' + req.files['video_file'][0].filename;
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.files['video_file'][0].filename,
        req.files['video_file'][0].mimetype,
        finalVideo
      ]);
    }

    await db.run(`
      UPDATE projects SET 
        title = ?, category = ?, description = ?, technologies = ?, image = ?, video = ?, website_link = ?, github_link = ?, challenges = ?, solutions = ?, client_info = ?
      WHERE id = ?`,
      [
        title, category, description, technologies, imagePath, finalVideo, website_link || '', github_link || '', challenges || '', solutions || '', client_info || '',
        projectId
      ]
    );

    await logActivity('Portfolio Update', `Updated project: "${title}" (ID: ${projectId})`);
    res.redirect('/admin/portfolio');
  } catch (err) {
    res.status(500).send('Error updating project: ' + err.message);
  }
});

// Portfolio Delete Project (Permanently)
router.post('/portfolio/delete/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const existing = await db.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    
    if (existing.length > 0) {
      const proj = existing[0];
      // Try to delete local image file
      if (proj.image && proj.image.startsWith('/uploads/')) {
        const fullImagePath = path.join(__dirname, '../../public', proj.image);
        if (fs.existsSync(fullImagePath)) {
          fs.unlinkSync(fullImagePath);
        }
      }
      // Try to delete local video file
      if (proj.video && proj.video.startsWith('/uploads/')) {
        const fullVideoPath = path.join(__dirname, '../../public', proj.video);
        if (fs.existsSync(fullVideoPath)) {
          fs.unlinkSync(fullVideoPath);
        }
      }

      await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
      await logActivity('Portfolio Delete', `Deleted project: "${proj.title}" permanently.`);
    }
    
    res.redirect('/admin/portfolio');
  } catch (err) {
    res.status(500).send('Error deleting project: ' + err.message);
  }
});

// 3. Blog Management
router.get('/blog', async (req, res) => {
  try {
    const blogs = await db.query('SELECT * FROM blogs ORDER BY id DESC');
    res.render('admin/blog-manage', { blogs });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Blog Add
router.post('/blog/add', upload.single('image'), async (req, res) => {
  try {
    const { title, content, category } = req.body;
    let imagePath = '/images/blog-placeholder.jpg';
    
    if (req.file) {
      imagePath = '/uploads/' + req.file.filename;
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.file.filename,
        req.file.mimetype,
        imagePath
      ]);
    }

    await db.run('INSERT INTO blogs (title, content, image, category) VALUES (?, ?, ?, ?)', [
      title, content, imagePath, category || 'Technology'
    ]);

    await logActivity('Blog Create', `Added article: "${title}"`);
    res.redirect('/admin/blog');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Blog Edit
router.post('/blog/edit/:id', upload.single('image'), async (req, res) => {
  try {
    const blogId = req.params.id;
    const { title, content, category } = req.body;
    const existing = await db.query('SELECT * FROM blogs WHERE id = ?', [blogId]);

    if (existing.length === 0) {
      return res.status(404).send('Blog not found');
    }

    let imagePath = existing[0].image;
    if (req.file) {
      imagePath = '/uploads/' + req.file.filename;
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.file.filename,
        req.file.mimetype,
        imagePath
      ]);
    }

    await db.run('UPDATE blogs SET title = ?, content = ?, image = ?, category = ? WHERE id = ?', [
      title, content, imagePath, category || 'Technology', blogId
    ]);

    await logActivity('Blog Update', `Updated article: "${title}"`);
    res.redirect('/admin/blog');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Blog Delete
router.post('/blog/delete/:id', async (req, res) => {
  try {
    const blogId = req.params.id;
    const existing = await db.query('SELECT * FROM blogs WHERE id = ?', [blogId]);

    if (existing.length > 0) {
      const blog = existing[0];
      if (blog.image && blog.image.startsWith('/uploads/')) {
        const fullImagePath = path.join(__dirname, '../../public', blog.image);
        if (fs.existsSync(fullImagePath)) {
          fs.unlinkSync(fullImagePath);
        }
      }
      await db.run('DELETE FROM blogs WHERE id = ?', [blogId]);
      await logActivity('Blog Delete', `Deleted blog post "${blog.title}" permanently.`);
    }

    res.redirect('/admin/blog');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 4. Services Management
router.get('/services', async (req, res) => {
  try {
    const services = await db.query('SELECT * FROM services ORDER BY id ASC');
    res.render('admin/services-manage', { services });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Service Add
router.post('/services/add', async (req, res) => {
  try {
    const { title, description, icon } = req.body;
    await db.run('INSERT INTO services (title, description, icon) VALUES (?, ?, ?)', [
      title, description, icon || 'bi-gear'
    ]);
    await logActivity('Service Create', `Added service: "${title}"`);
    res.redirect('/admin/services');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Service Edit
router.post('/services/edit/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    const { title, description, icon } = req.body;
    await db.run('UPDATE services SET title = ?, description = ?, icon = ? WHERE id = ?', [
      title, description, icon || 'bi-gear', serviceId
    ]);
    await logActivity('Service Update', `Updated service: "${title}"`);
    res.redirect('/admin/services');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Service Delete
router.post('/services/delete/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    const existing = await db.query('SELECT * FROM services WHERE id = ?', [serviceId]);
    if (existing.length > 0) {
      await db.run('DELETE FROM services WHERE id = ?', [serviceId]);
      await logActivity('Service Delete', `Deleted service "${existing[0].title}"`);
    }
    res.redirect('/admin/services');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 5. Testimonials Management
router.get('/testimonials', async (req, res) => {
  try {
    const testimonials = await db.query('SELECT * FROM testimonials ORDER BY id ASC');
    res.render('admin/testimonials-manage', { testimonials });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Testimonial Add
router.post('/testimonials/add', upload.single('image'), async (req, res) => {
  try {
    const { name, company, message } = req.body;
    let imagePath = '/images/avatar-placeholder.png';
    if (req.file) {
      imagePath = '/uploads/' + req.file.filename;
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.file.filename,
        req.file.mimetype,
        imagePath
      ]);
    }
    await db.run('INSERT INTO testimonials (name, company, message, image) VALUES (?, ?, ?, ?)', [
      name, company || '', message, imagePath
    ]);
    await logActivity('Testimonial Create', `Added testimonial from: "${name}"`);
    res.redirect('/admin/testimonials');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Testimonial Edit
router.post('/testimonials/edit/:id', upload.single('image'), async (req, res) => {
  try {
    const testimonialId = req.params.id;
    const { name, company, message } = req.body;
    const existing = await db.query('SELECT * FROM testimonials WHERE id = ?', [testimonialId]);
    if (existing.length === 0) return res.status(404).send('Testimonial not found');

    let imagePath = existing[0].image;
    if (req.file) {
      imagePath = '/uploads/' + req.file.filename;
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.file.filename,
        req.file.mimetype,
        imagePath
      ]);
    }
    await db.run('UPDATE testimonials SET name = ?, company = ?, message = ?, image = ? WHERE id = ?', [
      name, company || '', message, imagePath, testimonialId
    ]);
    await logActivity('Testimonial Update', `Updated testimonial from: "${name}"`);
    res.redirect('/admin/testimonials');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Testimonial Delete
router.post('/testimonials/delete/:id', async (req, res) => {
  try {
    const testimonialId = req.params.id;
    const existing = await db.query('SELECT * FROM testimonials WHERE id = ?', [testimonialId]);
    if (existing.length > 0) {
      const t = existing[0];
      if (t.image && t.image.startsWith('/uploads/')) {
        const fullImagePath = path.join(__dirname, '../../public', t.image);
        if (fs.existsSync(fullImagePath)) fs.unlinkSync(fullImagePath);
      }
      await db.run('DELETE FROM testimonials WHERE id = ?', [testimonialId]);
      await logActivity('Testimonial Delete', `Deleted testimonial from "${t.name}"`);
    }
    res.redirect('/admin/testimonials');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 6. Messages Inbox Management
router.get('/messages', async (req, res) => {
  try {
    const messages = await db.query('SELECT * FROM messages ORDER BY id DESC');
    res.render('admin/messages', { messages });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Message Mark Read
router.post('/messages/read/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    await db.run("UPDATE messages SET status = 'read' WHERE id = ?", [messageId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Message Delete
router.post('/messages/delete/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    await db.run('DELETE FROM messages WHERE id = ?', [messageId]);
    await logActivity('Message Delete', `Deleted message item ID: ${messageId}`);
    res.redirect('/admin/messages');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 7. Media Library
router.get('/media', async (req, res) => {
  try {
    const media = await db.query('SELECT * FROM media ORDER BY id DESC');
    res.render('admin/media-manage', { media, error: null });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Media upload standalone
router.post('/media/upload', upload.single('media_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }
    const pathUrl = '/uploads/' + req.file.filename;
    await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
      req.file.filename,
      req.file.mimetype,
      pathUrl
    ]);
    await logActivity('Media Upload', `Uploaded raw file: ${req.file.filename}`);
    res.redirect('/admin/media');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Media delete
router.post('/media/delete/:id', async (req, res) => {
  try {
    const mediaId = req.params.id;
    const existing = await db.query('SELECT * FROM media WHERE id = ?', [mediaId]);
    if (existing.length > 0) {
      const file = existing[0];
      const fullPath = path.join(__dirname, '../../public', file.path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      await db.run('DELETE FROM media WHERE id = ?', [mediaId]);
      await logActivity('Media Delete', `Deleted media file: ${file.filename} permanently.`);
    }
    res.redirect('/admin/media');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 8. Site settings, bio, credentials & Backup
router.get('/settings', async (req, res) => {
  try {
    const settingsList = await db.query('SELECT * FROM settings LIMIT 1');
    const settings = settingsList.length > 0 ? settingsList[0] : {};
    
    // Parse social links if string
    let parsedSocial = {};
    try {
      parsedSocial = typeof settings.social_links === 'string' ? JSON.parse(settings.social_links) : (settings.social_links || {});
    } catch (e) {
      parsedSocial = {};
    }

    res.render('admin/content-manage', {
      settings,
      socials: parsedSocial,
      error: null,
      success: null
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Update Profile Settings
router.post('/settings/update', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cv_file', maxCount: 1 }]), async (req, res) => {
  try {
    const { profile, email, phone, about_text, journey_text, goals_text, github, linkedin, instagram, twitter, facebook } = req.body;
    const socialLinks = JSON.stringify({ github, linkedin, instagram, twitter, facebook });
    
    const settingsList = await db.query('SELECT * FROM settings LIMIT 1');
    const hasSettings = settingsList.length > 0;
    const current = settingsList[0] || {};

    let logoPath = current.logo || '';
    if (req.files && req.files['logo']) {
      logoPath = '/uploads/' + req.files['logo'][0].filename;
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.files['logo'][0].filename,
        req.files['logo'][0].mimetype,
        logoPath
      ]);
    }

    let cvPath = current.cv_url || '';
    if (req.files && req.files['cv_file']) {
      cvPath = '/uploads/' + req.files['cv_file'][0].filename;
      await db.run('INSERT INTO media (filename, type, path) VALUES (?, ?, ?)', [
        req.files['cv_file'][0].filename,
        req.files['cv_file'][0].mimetype,
        cvPath
      ]);
      // Copy to custom static path for easy download linking
      const staticCvPath = path.resolve(__dirname, '../../public/uploads/cv_evance_dionis.pdf');
      fs.copyFileSync(req.files['cv_file'][0].path, staticCvPath);
    }

    if (hasSettings) {
      await db.run(`
        UPDATE settings SET 
          profile = ?, email = ?, phone = ?, social_links = ?, logo = ?, cv_url = ?, about_text = ?, journey_text = ?, goals_text = ?
        WHERE id = ?`,
        [profile, email, phone, socialLinks, logoPath, cvPath, about_text, journey_text, goals_text, current.id]
      );
    } else {
      await db.run(`
        INSERT INTO settings (
          profile, email, phone, social_links, logo, cv_url, about_text, journey_text, goals_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [profile, email, phone, socialLinks, logoPath, cvPath, about_text, journey_text, goals_text]
      );
    }

    await logActivity('Settings Update', 'Updated site biography and contact credentials.');
    res.redirect('/admin/settings');
  } catch (err) {
    res.status(500).send('Error saving settings: ' + err.message);
  }
});

// Update Admin Password
router.post('/settings/password', async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    
    if (new_password !== confirm_password) {
      return res.status(400).send('New passwords do not match.');
    }

    const username = req.session.username;
    const users = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length > 0) {
      const user = users[0];
      const match = bcrypt.compareSync(current_password, user.password);
      
      if (match) {
        const hashed = bcrypt.hashSync(new_password, 10);
        await db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
        await logActivity('Password Change', `Changed security credentials for admin user: ${username}`);
        return res.send('Password updated successfully. Go back to <a href="/admin">Dashboard</a>.');
      }
    }
    res.status(400).send('Incorrect current password.');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Backup System (Dumps database data as downloadable JSON)
router.get('/backup/download', async (req, res) => {
  try {
    const backupData = {};
    const tables = ['users', 'projects', 'services', 'blogs', 'media', 'messages', 'testimonials', 'analytics', 'settings', 'activity_logs'];

    for (const t of tables) {
      backupData[t] = await db.query(`SELECT * FROM ${t}`);
    }

    const filename = `db_backup_${Date.now()}.json`;
    res.header('Content-Type', 'application/json');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupData, null, 2));
    await logActivity('Backup Export', 'Downloaded system database tables backup file.');
  } catch (err) {
    res.status(500).send('Backup download failed: ' + err.message);
  }
});

// Reset Visitor Analytics
router.post('/analytics/reset', async (req, res) => {
  try {
    await db.run('DELETE FROM analytics');
    await logActivity('Analytics Reset', 'Cleared all visitor tracking analytics logs.');
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Reset failed: ' + err.message);
  }
});

// Dedicated CV Upload Handler
router.post('/settings/cv', upload.single('cv_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }
    const cvPath = '/uploads/' + req.file.filename;
    
    // Update settings table
    const settingsList = await db.query('SELECT * FROM settings LIMIT 1');
    if (settingsList.length > 0) {
      await db.run('UPDATE settings SET cv_url = ? WHERE id = ?', [cvPath, settingsList[0].id]);
    } else {
      await db.run('INSERT INTO settings (profile, email, phone, social_links, cv_url) VALUES (?, ?, ?, ?, ?)', [
        'Evance Dionis Chrisostom', 'evancechrisostom05@gmail.com', '+255611542524', '{}', cvPath
      ]);
    }

    // Copy to static path for CV download route
    const staticCvPath = path.resolve(__dirname, '../../public/uploads/cv_evance_dionis.pdf');
    fs.copyFileSync(req.file.path, staticCvPath);

    await logActivity('CV Upload', 'Uploaded new curriculum vitae document.');
    res.redirect('/admin/settings');
  } catch (err) {
    res.status(500).send('CV upload failed: ' + err.message);
  }
});

module.exports = router;
