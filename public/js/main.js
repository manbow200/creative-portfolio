document.addEventListener('DOMContentLoaded', () => {
  
  // ====================================================
  // 1. THEME SWITCHING (DARK/LIGHT MODE)
  // ====================================================
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;
  
  // Set default theme from localStorage
  const currentTheme = localStorage.getItem('theme') || 'dark';
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    if (themeIcon) {
      themeIcon.classList.replace('bi-moon', 'bi-sun');
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      let theme = 'dark';
      
      if (document.body.classList.contains('light-theme')) {
        theme = 'light';
        themeIcon.classList.replace('bi-moon', 'bi-sun');
      } else {
        themeIcon.classList.replace('bi-sun', 'bi-moon');
      }
      
      localStorage.setItem('theme', theme);
    });
  }

  // ====================================================
  // 2. HEADER SCROLL EFFECT
  // ====================================================
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // ====================================================
  // 3. RESPONSIVE BURGER MENU
  // ====================================================
  const burgerMenu = document.getElementById('burger-menu');
  const navLinks = document.querySelector('.nav-links');

  if (burgerMenu && navLinks) {
    burgerMenu.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      const burgerIcon = burgerMenu.querySelector('i');
      if (navLinks.classList.contains('active')) {
        burgerIcon.classList.replace('bi-list', 'bi-x');
      } else {
        burgerIcon.classList.replace('bi-x', 'bi-list');
      }
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        burgerMenu.querySelector('i').classList.replace('bi-x', 'bi-list');
      });
    });
  }

  // ====================================================
  // 4. INSTANT CLIENT-SIDE PORTFOLIO FILTER
  // ====================================================
  const filterButtons = document.querySelectorAll('.filter-btn');
  const portfolioCards = document.querySelectorAll('.portfolio-card');

  if (filterButtons.length > 0 && portfolioCards.length > 0) {
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active class
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const category = btn.getAttribute('data-filter');

        portfolioCards.forEach(card => {
          const cardCategory = card.getAttribute('data-category');
          if (category === 'all' || cardCategory === category) {
            card.style.display = 'block';
            setTimeout(() => {
              card.style.opacity = '1';
              card.style.transform = 'scale(1)';
            }, 50);
          } else {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
              card.style.display = 'none';
            }, 300);
          }
        });
      });
    });
  }

  // ====================================================
  // 5. INTERSECTION OBSERVER ANIMATIONS
  // ====================================================
  const animatedElements = document.querySelectorAll('.animate-on-scroll');
  
  if ('IntersectionObserver' in window && animatedElements.length > 0) {
    const observerOptions = {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    animatedElements.forEach(el => observer.observe(el));
  } else {
    // Fallback if Observer is not supported
    animatedElements.forEach(el => el.classList.add('active'));
  }

  // ====================================================
  // 6. SKILL PROGRESS BAR ANIMS (SCROLL TRIGGERED)
  // ====================================================
  const skillsSection = document.querySelector('.skills-section');
  const skillFills = document.querySelectorAll('.skill-fill');

  if (skillsSection && skillFills.length > 0 && 'IntersectionObserver' in window) {
    const skillsObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          skillFills.forEach(fill => {
            const percent = fill.getAttribute('data-percent');
            fill.style.width = percent + '%';
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    skillsObserver.observe(skillsSection);
  } else if (skillFills.length > 0) {
    // Fallback
    setTimeout(() => {
      skillFills.forEach(fill => {
        const percent = fill.getAttribute('data-percent');
        fill.style.width = percent + '%';
      });
    }, 500);
  }

  // ====================================================
  // 7. CONTACT FORM SUBMISSION (AJAX)
  // ====================================================
  const contactForm = document.getElementById('contact-form');
  const formFeedback = document.getElementById('form-feedback');

  if (contactForm && formFeedback) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const origText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Sending...';

      formFeedback.style.display = 'none';
      formFeedback.className = 'form-feedback';

      const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        message: document.getElementById('message').value
      };

      try {
        const response = await fetch('/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
          formFeedback.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${result.message}`;
          formFeedback.classList.add('success');
          formFeedback.style.display = 'block';
          contactForm.reset();
        } else {
          throw new Error(result.message || 'An unexpected error occurred.');
        }
      } catch (err) {
        formFeedback.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> Error: ${err.message}`;
        formFeedback.classList.add('error');
        formFeedback.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
    });
  }

  // ====================================================
  // 8. FLOATING WHATSAPP TRIGGER
  // ====================================================
  const waFloat = document.getElementById('whatsapp-float');
  if (waFloat) {
    waFloat.addEventListener('click', (e) => {
      // Prevents click issues, logs hit or directly triggers WhatsApp redirect
      console.log('WhatsApp connection initiated by visitor.');
    });
  }
});
