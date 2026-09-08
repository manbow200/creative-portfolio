const express = require('express');
const router = express.Router();
const db = require('../db/db');
const fs = require('fs');
const path = require('path');

// Simple Markdown to HTML parser for blog content
function parseMarkdown(md) {
  if (!md) return '';
  
  // Escape HTML tags to prevent XSS
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code Blocks
  html = html.replace(/```javascript([\s\S]*?)```/gm, '<pre><code class="language-javascript">$1</code></pre>');
  html = html.replace(/```css([\s\S]*?)```/gm, '<pre><code class="language-css">$1</code></pre>');
  html = html.replace(/```html([\s\S]*?)```/gm, '<pre><code class="language-html">$1</code></pre>');
  html = html.replace(/```([\s\S]*?)```/gm, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Paragraphs
  html = html.replace(/\r\n\r\n/g, '</p><p>').replace(/\n\n/g, '</p><p>');
  html = '<p>' + html.replace(/\n/g, '<br>') + '</p>';
  
  // Cleanup empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  return html;
}

// Helper to calculate reading time
function calculateReadingTime(text) {
  const wordsPerMinute = 200;
  const words = text ? text.split(/\s+/).length : 0;
  return Math.ceil(words / wordsPerMinute);
}

// Global Middleware to inject Settings into all templates
router.use(async (req, res, next) => {
  try {
    const settingsList = await db.query('SELECT * FROM settings LIMIT 1');
    if (settingsList.length > 0) {
      const sets = settingsList[0];
      try {
        sets.social_links = JSON.parse(sets.social_links || '{}');
        sets.education_text = JSON.parse(sets.education_text || '[]');
        sets.experience_text = JSON.parse(sets.experience_text || '[]');
      } catch (e) {
        sets.social_links = {};
        sets.education_text = [];
        sets.experience_text = [];
      }
      res.locals.settings = sets;
    } else {
      res.locals.settings = {
        profile: 'Evance Dionis Chrisostom',
        email: 'evancechrisostom05@gmail.com',
        phone: '+255611542524',
        social_links: {},
        about_text: '',
        journey_text: '',
        education_text: [],
        experience_text: [],
        goals_text: '',
        logo: '',
        cv_url: ''
      };
    }
  } catch (err) {
    console.error('Error fetching global settings:', err.message);
  }
  next();
});

// 1. Home Route
router.get('/', async (req, res) => {
  try {
    const services = await db.query('SELECT * FROM services ORDER BY id ASC');
    const projects = await db.query('SELECT * FROM projects ORDER BY id DESC LIMIT 3');
    const blogs = await db.query('SELECT * FROM blogs ORDER BY id DESC LIMIT 2');
    const testimonials = await db.query('SELECT * FROM testimonials ORDER BY id ASC');

    res.render('pages/home', {
      services,
      projects,
      blogs,
      testimonials,
      activeUsersCount: req.getActiveUsersCount()
    });
  } catch (err) {
    res.status(500).send('Internal Server Error: ' + err.message);
  }
});

// 2. About Route
router.get('/about', (req, res) => {
  res.render('pages/about');
});

// 3. Services Route
router.get('/services', async (req, res) => {
  try {
    const services = await db.query('SELECT * FROM services ORDER BY id ASC');
    res.render('pages/services', { services });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// 4. Portfolio Route
router.get('/portfolio', async (req, res) => {
  try {
    const query = req.query.search || '';
    const category = req.query.category || '';
    
    let sql = 'SELECT * FROM projects';
    const params = [];

    if (query || category) {
      sql += ' WHERE';
      const filters = [];
      if (query) {
        filters.push(' (title LIKE ? OR description LIKE ? OR technologies LIKE ?)');
        params.push(`%${query}%`, `%${query}%`, `%${query}%`);
      }
      if (category) {
        filters.push(' category = ?');
        params.push(category);
      }
      sql += filters.join(' AND');
    }
    
    sql += ' ORDER BY id DESC';
    const projects = await db.query(sql, params);
    
    // Fetch unique categories
    const categoriesRows = await db.query('SELECT DISTINCT category FROM projects');
    const categories = categoriesRows.map(c => c.category);

    res.render('pages/portfolio', {
      projects,
      categories,
      selectedCategory: category,
      searchQuery: query
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// 5. Project Detail Route
router.get('/portfolio/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const projectRows = await db.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    
    if (projectRows.length === 0) {
      return res.status(404).send('Project Not Found');
    }

    const project = projectRows[0];
    
    // Increment project view count
    await db.run('UPDATE projects SET views = views + 1 WHERE id = ?', [projectId]);

    res.render('pages/project-detail', { project });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// 6. Blog Route
router.get('/blog', async (req, res) => {
  try {
    const query = req.query.search || '';
    let sql = 'SELECT * FROM blogs';
    const params = [];

    if (query) {
      sql += ' WHERE title LIKE ? OR content LIKE ?';
      params.push(`%${query}%`, `%${query}%`);
    }

    sql += ' ORDER BY id DESC';
    const blogs = await db.query(sql, params);

    // Calculate reading time for each blog
    blogs.forEach(b => {
      b.readingTime = calculateReadingTime(b.content);
    });

    res.render('pages/blog', { blogs, searchQuery: query });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// 7. Blog Detail Route
router.get('/blog/:id', async (req, res) => {
  try {
    const blogId = req.params.id;
    const blogRows = await db.query('SELECT * FROM blogs WHERE id = ?', [blogId]);

    if (blogRows.length === 0) {
      return res.status(404).send('Blog Post Not Found');
    }

    const blog = blogRows[0];
    
    // Increment view count
    await db.run('UPDATE blogs SET views = views + 1 WHERE id = ?', [blogId]);

    blog.readingTime = calculateReadingTime(blog.content);
    blog.parsedContent = parseMarkdown(blog.content);

    // Fetch related blogs
    const relatedBlogs = await db.query('SELECT * FROM blogs WHERE id != ? AND category = ? ORDER BY id DESC LIMIT 2', [blogId, blog.category]);

    res.render('pages/blog-post', { blog, relatedBlogs });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// 8. Contact Route (Submit Form)
router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    await db.run('INSERT INTO messages (name, email, phone, message, status) VALUES (?, ?, ?, ?, ?)', [
      name, email, phone || '', message, 'unread'
    ]);

    res.json({ success: true, message: 'Your message has been sent successfully. Evance will get back to you shortly!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send message: ' + err.message });
  }
});

// 9. CV Download Route
router.get('/download-cv', (req, res) => {
  const filePath = path.resolve(__dirname, '../../public/uploads/cv_evance_dionis.pdf');
  // Check if file exists, if not serve a blank or default PDF
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'Evance_Dionis_Chrisostom_CV.pdf');
  } else {
    // If CV file doesn't exist, redirect back with warning or serve dynamic message
    res.status(404).send('CV document is currently being updated by administrator. Please check again soon or contact directly.');
  }
});

// 10. Sitemap XML route
router.get('/sitemap.xml', async (req, res) => {
  try {
    const host = `${req.protocol}://${req.get('host')}`;
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Core routes
    const coreRoutes = ['', '/about', '/services', '/portfolio', '/blog'];
    coreRoutes.forEach(r => {
      xml += '  <url>\n';
      xml += `    <loc>${host}${r}</loc>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });

    // Dynamic Projects
    const projects = await db.query('SELECT id FROM projects');
    projects.forEach(p => {
      xml += '  <url>\n';
      xml += `    <loc>${host}/portfolio/${p.id}</loc>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    });

    // Dynamic Blogs
    const blogs = await db.query('SELECT id FROM blogs');
    blogs.forEach(b => {
      xml += '  <url>\n';
      xml += `    <loc>${host}/blog/${b.id}</loc>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).send('Sitemap generation error');
  }
});

// 11. Robots.txt route
router.get('/robots.txt', (req, res) => {
  const host = `${req.protocol}://${req.get('host')}`;
  res.header('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${host}/sitemap.xml
`);
});

module.exports = router;
