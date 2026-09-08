const db = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Starting database seeding...');
  await db.connect();

  const isMySQL = db.type === 'mysql';
  
  // Table creation scripts
  const schema = {
    users: isMySQL ? `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,

    projects: isMySQL ? `
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        technologies VARCHAR(255) NOT NULL,
        image VARCHAR(255) NOT NULL,
        video VARCHAR(255) DEFAULT '',
        website_link VARCHAR(255) DEFAULT '',
        github_link VARCHAR(255) DEFAULT '',
        views INT DEFAULT 0,
        challenges TEXT,
        solutions TEXT,
        client_info VARCHAR(255) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        technologies TEXT NOT NULL,
        image TEXT NOT NULL,
        video TEXT DEFAULT '',
        website_link TEXT DEFAULT '',
        github_link TEXT DEFAULT '',
        views INTEGER DEFAULT 0,
        challenges TEXT,
        solutions TEXT,
        client_info TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,

    services: isMySQL ? `
      CREATE TABLE IF NOT EXISTS services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL
      );
    `,

    blogs: isMySQL ? `
      CREATE TABLE IF NOT EXISTS blogs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        image VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Technology',
        views INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS blogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image TEXT NOT NULL,
        category TEXT DEFAULT 'Technology',
        views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,

    media: isMySQL ? `
      CREATE TABLE IF NOT EXISTS media (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        path VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,

    messages: isMySQL ? `
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT '',
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'unread',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT DEFAULT '',
        message TEXT NOT NULL,
        status TEXT DEFAULT 'unread',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,

    testimonials: isMySQL ? `
      CREATE TABLE IF NOT EXISTS testimonials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255) DEFAULT '',
        message TEXT NOT NULL,
        image VARCHAR(255) DEFAULT ''
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company TEXT DEFAULT '',
        message TEXT NOT NULL,
        image TEXT DEFAULT ''
      );
    `,

    analytics: isMySQL ? `
      CREATE TABLE IF NOT EXISTS analytics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        page VARCHAR(255) NOT NULL,
        device VARCHAR(100) DEFAULT 'Desktop',
        browser VARCHAR(100) DEFAULT 'Unknown',
        source VARCHAR(255) DEFAULT 'Direct',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page TEXT NOT NULL,
        device TEXT DEFAULT 'Desktop',
        browser TEXT DEFAULT 'Unknown',
        source TEXT DEFAULT 'Direct',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,

    settings: isMySQL ? `
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        profile VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        social_links TEXT NOT NULL,
        logo VARCHAR(255) DEFAULT '',
        cv_url VARCHAR(255) DEFAULT '',
        about_text TEXT,
        journey_text TEXT,
        education_text TEXT,
        experience_text TEXT,
        goals_text TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        social_links TEXT NOT NULL,
        logo TEXT DEFAULT '',
        cv_url TEXT DEFAULT '',
        about_text TEXT,
        journey_text TEXT,
        education_text TEXT,
        experience_text TEXT,
        goals_text TEXT
      );
    `,

    activity_logs: isMySQL ? `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ` : `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `
  };

  // Run table creations
  for (const [tableName, createQuery] of Object.entries(schema)) {
    try {
      await db.exec(createQuery);
      console.log(`Table '${tableName}' checked/created.`);
    } catch (err) {
      console.error(`Error creating table '${tableName}':`, err.message);
    }
  }

  // Seed default admin user if none exists
  const existingUsers = await db.query('SELECT * FROM users WHERE username = ?', ['admin']);
  if (existingUsers.length === 0) {
    const passwordHash = bcrypt.hashSync('password123', 10);
    await db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [
      'admin',
      'evancechrisostom05@gmail.com',
      passwordHash
    ]);
    console.log('Seeded default admin user: admin / password123');
  }

  // Seed settings if empty
  const existingSettings = await db.query('SELECT * FROM settings LIMIT 1');
  if (existingSettings.length === 0) {
    const socialLinks = JSON.stringify({
      github: 'https://github.com/evancechrisostom',
      linkedin: 'https://linkedin.com/in/evancechrisostom',
      instagram: 'https://instagram.com/evancechrisostom',
      twitter: 'https://twitter.com/evancechrisostom',
      facebook: 'https://facebook.com/evancechrisostom'
    });

    const aboutText = "I am a versatile Creative Technology Specialist with a passion for integrating coding, design, and hardware troubleshooting. With expertise spanning Web Development, UI/UX, Graphic Design, IT Support, and Social Media Management, I build end-to-end digital solutions that scale.";
    
    const journeyText = "My journey started with a curiosity about how hardware components interact, leading me to computer maintenance. Over time, I expanded my skills into visual graphics, UI designs, frontend code, backend services, and marketing systems. Today, I work as a cross-disciplinary digital creator.";

    const educationText = JSON.stringify([
      { year: '2020 - 2023', degree: 'Bachelor of Science in Computer Science', school: 'University of Technology' },
      { year: '2018 - 2020', degree: 'Advanced Diploma in Graphic Design & UI/UX', school: 'Creative Arts Academy' }
    ]);

    const experienceText = JSON.stringify([
      { year: '2024 - Present', role: 'Full Stack Web Developer & Digital Creator', company: 'Freelance & Contract Work' },
      { year: '2022 - 2024', role: 'IT Support & Systems Administrator', company: 'ByteCare Solutions' },
      { year: '2020 - 2022', role: 'Graphic & UI/UX Designer', company: 'PixelCraft Agency' }
    ]);

    const goalsText = "My goal is to bridge the gap between creative visual artistry and complex technical engineering. I aim to build high-performance products that not only function flawlessly but also capture user engagement through sleek aesthetics and smooth usability.";

    await db.run(`
      INSERT INTO settings (
        profile, email, phone, social_links, logo, cv_url, about_text, journey_text, education_text, experience_text, goals_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Evance Dionis Chrisostom',
        'evancechrisostom05@gmail.com',
        '+255611542524',
        socialLinks,
        '/images/logo.png',
        '/uploads/cv_evance_dionis.pdf',
        aboutText,
        journeyText,
        educationText,
        experienceText,
        goalsText
      ]
    );
    console.log('Seeded default settings for Evance Dionis Chrisostom.');
  }

  // Seed sample services
  const existingServices = await db.query('SELECT * FROM services LIMIT 1');
  if (existingServices.length === 0) {
    const services = [
      { title: 'Graphic Design', description: 'Logo Design, Branding, Posters, Flyers, Social Media Graphics, and print marketing materials that establish corporate identity.', icon: 'bi-palette' },
      { title: 'Web Development', description: 'Business websites, Custom e-commerce web applications, management portals, and API integrations with secure database systems.', icon: 'bi-code-slash' },
      { title: 'UI/UX Design', description: 'Interactive wireframes, high-fidelity mobile app designs, web UI prototypes, and user journey optimization.', icon: 'bi-vector-pen' },
      { title: 'Computer Repair & IT Support', description: 'Operating system installation, hardware diagnosis and upgrades, software configuration, and proactive hardware maintenance.', icon: 'bi-cpu' },
      { title: 'Social Media Management', description: 'Targeted content creation, social media branding grids, community page management, and marketing campaign strategy.', icon: 'bi-megaphone' }
    ];

    for (const s of services) {
      await db.run('INSERT INTO services (title, description, icon) VALUES (?, ?, ?)', [s.title, s.description, s.icon]);
    }
    console.log('Seeded default services.');
  }

  // Ensure database starts completely empty of false mock data
  await db.run('DELETE FROM projects');
  await db.run('DELETE FROM testimonials');
  await db.run('DELETE FROM blogs');
  await db.run('DELETE FROM messages');
  await db.run('DELETE FROM analytics');
  await db.run('DELETE FROM media');
  console.log('Cleared all mock data from projects, blogs, testimonials, messages, media, and analytics.');

  console.log('Database seeding completed successfully.');
  await db.close();
}

seed().catch(err => {
  console.error('Database seeding failed:', err);
  process.exit(1);
});
