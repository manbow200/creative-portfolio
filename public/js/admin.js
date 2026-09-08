document.addEventListener('DOMContentLoaded', () => {
  // Mobile sidebar toggle
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  
  // Create mobile menu toggle on the fly for admin panel if missing
  const header = document.querySelector('.admin-header');
  if (header && window.innerWidth <= 768) {
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '<i class="bi bi-list"></i>';
    toggleBtn.style.background = 'none';
    toggleBtn.style.border = 'none';
    toggleBtn.style.color = '#fff';
    toggleBtn.style.fontSize = '1.5rem';
    toggleBtn.style.marginRight = '15px';
    toggleBtn.style.cursor = 'pointer';
    
    header.prepend(toggleBtn);
    
    toggleBtn.addEventListener('click', () => {
      if (sidebar.style.left === '0px') {
        sidebar.style.left = '-260px';
      } else {
        sidebar.style.left = '0px';
      }
    });
  }

  // AJAX to Mark Message as Read
  const readButtons = document.querySelectorAll('.mark-read-btn');
  readButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const msgId = btn.getAttribute('data-id');
      const msgItem = document.getElementById(`msg-${msgId}`);
      
      try {
        const response = await fetch(`/admin/messages/read/${msgId}`, {
          method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
          btn.remove();
          if (msgItem) {
            msgItem.classList.remove('unread');
            const statusBadge = msgItem.querySelector('.badge');
            if (statusBadge) {
              statusBadge.className = 'badge badge-success';
              statusBadge.textContent = 'Read';
            }
          }
        }
      } catch (err) {
        console.error('Failed to mark message as read:', err);
      }
    });
  });

  // Client-side quick filter in admin grids
  const searchInput = document.getElementById('table-search');
  const tableRows = document.querySelectorAll('table.admin-table tbody tr');
  
  if (searchInput && tableRows.length > 0) {
    searchInput.addEventListener('keyup', (e) => {
      const term = e.target.value.toLowerCase();
      tableRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }
});

// Helper to open Edit Form modals
function openEditProjectModal(project) {
  const modal = document.getElementById('edit-project-modal');
  if (!modal) return;
  
  modal.querySelector('form').action = `/admin/portfolio/edit/${project.id}`;
  modal.querySelector('#edit-title').value = project.title;
  modal.querySelector('#edit-category').value = project.category;
  modal.querySelector('#edit-description').value = project.description;
  modal.querySelector('#edit-technologies').value = project.technologies;
  modal.querySelector('#edit-website_link').value = project.website_link || '';
  modal.querySelector('#edit-github_link').value = project.github_link || '';
  modal.querySelector('#edit-video_url').value = project.video || '';
  modal.querySelector('#edit-challenges').value = project.challenges || '';
  modal.querySelector('#edit-solutions').value = project.solutions || '';
  modal.querySelector('#edit-client_info').value = project.client_info || '';
  
  modal.style.display = 'block';
}

function openEditBlogModal(blog) {
  const modal = document.getElementById('edit-blog-modal');
  if (!modal) return;
  
  modal.querySelector('form').action = `/admin/blog/edit/${blog.id}`;
  modal.querySelector('#edit-title').value = blog.title;
  modal.querySelector('#edit-content').value = blog.content;
  modal.querySelector('#edit-category').value = blog.category;
  
  modal.style.display = 'block';
}

function openEditServiceModal(service) {
  const modal = document.getElementById('edit-service-modal');
  if (!modal) return;
  
  modal.querySelector('form').action = `/admin/services/edit/${service.id}`;
  modal.querySelector('#edit-title').value = service.title;
  modal.querySelector('#edit-description').value = service.description;
  modal.querySelector('#edit-icon').value = service.icon;
  
  modal.style.display = 'block';
}

function openEditTestimonialModal(testimonial) {
  const modal = document.getElementById('edit-testimonial-modal');
  if (!modal) return;
  
  modal.querySelector('form').action = `/admin/testimonials/edit/${testimonial.id}`;
  modal.querySelector('#edit-name').value = testimonial.name;
  modal.querySelector('#edit-company').value = testimonial.company || '';
  modal.querySelector('#edit-message').value = testimonial.message;
  
  modal.style.display = 'block';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}
