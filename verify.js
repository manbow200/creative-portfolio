const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Evance Dionis CMS Setup & Validation ---');

const projectRoot = __dirname;
const imagesDir = path.join(projectRoot, 'public', 'images');
const uploadsDir = path.join(projectRoot, 'public', 'uploads');

// 1. Ensure Directories Exist
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log('Created public/images directory.');
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created public/uploads directory.');
}

// 2. Copy Generated Logo
const generatedLogoPath = 'C:\\Users\\ashferd\\.gemini\\antigravity\\brain\\2c0e6933-8f47-4e72-8cc2-82c036883fbb\\logo_1784200621037.png';
const targetLogoPath = path.join(imagesDir, 'logo.png');

try {
  if (fs.existsSync(generatedLogoPath)) {
    fs.copyFileSync(generatedLogoPath, targetLogoPath);
    console.log('Successfully copied generated logo.png to public/images/.');
  } else {
    // If not found, write a minimal blank PNG or copy a mock
    console.log('Generated logo not found at absolute path, setting up fallback.');
    fs.writeFileSync(targetLogoPath, ''); // Empty file
  }
} catch (e) {
  console.error('Error copying logo asset:', e.message);
}

// 3. Create SVG placeholders for projects and avatars to avoid 404s
const placeholders = {
  'placeholder.jpg': `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#131a2c"/><text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="#6366f1" dominant-baseline="middle" text-anchor="middle">Project Screenshot</text></svg>`,
  'blog-placeholder.jpg': `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#131a2c"/><text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="#a855f7" dominant-baseline="middle" text-anchor="middle">Blog Tutorial</text></svg>`,
  'avatar-placeholder.png': `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#182235"/><circle cx="100%" cy="100%" r="80" fill="#6366f1"/><text x="50%" y="50%" font-family="sans-serif" font-size="40" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">ED</text></svg>`,
  
  // Specific seed items
  'project1.jpg': `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#090d16"/><text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="#6366f1" dominant-baseline="middle" text-anchor="middle">Management System</text></svg>`,
  'project2.jpg': `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101726"/><text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="#a855f7" dominant-baseline="middle" text-anchor="middle">Coffee Branding</text></svg>`,
  'project3.jpg': `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#182235"/><text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="#06b6d4" dominant-baseline="middle" text-anchor="middle">App UI Design</text></svg>`,
  'project4.jpg': `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0b0f19"/><text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="#10b981" dominant-baseline="middle" text-anchor="middle">PC Hardware Upgrade</text></svg>`,
  
  'avatar1.jpg': `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="90" fill="#6366f1"/><text x="100" y="110" font-family="sans-serif" font-size="40" fill="#fff" dominant-baseline="middle" text-anchor="middle">DM</text></svg>`,
  'avatar2.jpg': `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="90" fill="#a855f7"/><text x="100" y="110" font-family="sans-serif" font-size="40" fill="#fff" dominant-baseline="middle" text-anchor="middle">NL</text></svg>`,
  'avatar3.jpg': `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="90" fill="#06b6d4"/><text x="100" y="110" font-family="sans-serif" font-size="40" fill="#fff" dominant-baseline="middle" text-anchor="middle">SJ</text></svg>`,
  
  'blog1.jpg': `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="50%" font-family="sans-serif" font-size="22" fill="#6366f1" dominant-baseline="middle" text-anchor="middle">Node.js Performance Optimization</text></svg>`,
  'blog2.jpg': `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1e293b"/><text x="50%" y="50%" font-family="sans-serif" font-size="22" fill="#ef4444" dominant-baseline="middle" text-anchor="middle">GPU/CPU Thermal Care</text></svg>`
};

for (const [name, svgContent] of Object.entries(placeholders)) {
  const filePath = path.join(imagesDir, name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, svgContent);
    console.log(`Created image asset: public/images/${name}`);
  }
}

// 4. Run Seeding Script
console.log('Seeding database tables...');
try {
  const output = execSync('node src/db/seed.js', { encoding: 'utf8' });
  console.log(output);
} catch (err) {
  console.error('Error seeding database:', err.message);
  process.exit(1);
}

console.log('Setup completed successfully! Run "node server.js" to launch.');
