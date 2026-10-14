// Presentation only: retain the existing section loaders and API workflows.
function openPlanningModule(module) {
  mvpTab = module;
  switchTab('dashboard');
}

const navigationToggle = document.getElementById('navigation-toggle');
const primaryNavigation = document.getElementById('primary-navigation');
function closeNavigation() {
  navigationToggle.setAttribute('aria-expanded', 'false');
  primaryNavigation.classList.remove('is-open');
}
navigationToggle.addEventListener('click', () => {
  const open = navigationToggle.getAttribute('aria-expanded') !== 'true';
  navigationToggle.setAttribute('aria-expanded', String(open));
  primaryNavigation.classList.toggle('is-open', open);
});
primaryNavigation.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeNavigation();
    navigationToggle.focus();
  }
});
navigationToggle.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeNavigation();
});
primaryNavigation.addEventListener('click', event => {
  if (!event.target.closest('.nav-tab')) return;
  const section = document.getElementById('section-' + currentTab);
  section.setAttribute('tabindex', '-1');
  section.focus({ preventScroll: true });
});

const polishSwitchTab = switchTab;
switchTab = function(tab) {
  polishSwitchTab(tab);
  primaryNavigation.querySelectorAll('.nav-tab').forEach(button => {
    if (button.id === 'tab-' + tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const active = document.getElementById('tab-' + tab);
  if (active) document.getElementById('navigation-current').textContent = active.textContent.trim();
  closeNavigation();
};
document.getElementById('tab-home').setAttribute('aria-current', 'page');
primaryNavigation.dataset.enhanced = 'true';
