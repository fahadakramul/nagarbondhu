// Visual adapters only. Existing API calls, calculations and workflow handlers remain authoritative.
async function checkEngineConnection() {
  const badge = document.getElementById('engine-status');
  const label = document.getElementById('engine-status-label');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/v1/health', { signal: controller.signal });
    const health = await response.json();
    if (!response.ok || health.status !== 'healthy') throw new Error('Unavailable');
    badge.classList.add('is-live');
    label.textContent = '• Live Engine';
    badge.title = 'Application server online; AI availability is shown with each analysis.';
  } catch {
    badge.classList.remove('is-live');
    label.textContent = '• সংযোগ অনুপলব্ধ';
    badge.title = 'Application server connection unavailable';
  } finally {
    clearTimeout(timer);
  }
}
checkEngineConnection();

const mapFilters = document.getElementById('map-filters');
if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 640px)').matches) mapFilters.open = true;
const timelinePresentation = openTimelineMap;
openTimelineMap = function() { timelinePresentation(); mapFilters.open = true; };
function syncMapFilterSummary() {
  const source = document.getElementById('map-source');
  const at = document.getElementById('twin-at')?.value;
  document.getElementById('map-filter-source').textContent = source.selectedOptions[0].textContent + (at ? ' • ' + at : '');
}
document.getElementById('map-source').addEventListener('change', syncMapFilterSummary);
new MutationObserver(syncMapFilterSummary).observe(document.getElementById('twin-controls'), { childList: true, characterData: true, subtree: true });

function syncVoiceAppearance() {
  const recording = typeof voiceRecorder !== 'undefined' && voiceRecorder?.state === 'recording';
  document.getElementById('voice-input-card').classList.toggle('is-recording', recording);
}
new MutationObserver(syncVoiceAppearance).observe(document.getElementById('voice-stop'), { attributes: true, attributeFilter: ['class'] });
syncVoiceAppearance();

for (const id of ['btn-submit-report', 'btn-ai-preview']) {
  const button = document.getElementById(id);
  new MutationObserver(() => button.setAttribute('aria-busy', String(button.disabled))).observe(button, { attributes: true, attributeFilter: ['disabled'] });
}

for (const id of ['ai-preview-severity', 'modal-ai-severity']) {
  const element = document.getElementById(id);
  const sync = () => { element.dataset.severity = /^[1-5]$/.test(element.textContent.trim()) ? element.textContent.trim() : ''; };
  new MutationObserver(sync).observe(element, { childList: true, characterData: true, subtree: true });
  sync();
}

function decorateReportPresentation(report) {
  document.getElementById('modal-priority-level')?.remove();
  const score = document.getElementById('modal-prio-score');
  score.classList.remove('risk-score');
  score.removeAttribute('data-risk');
  score.style.removeProperty('--score-angle');
  const value = report.priorityAssessment?.score;
  if (typeof value === 'number' && Number.isFinite(value)) {
    score.classList.add('risk-score');
    score.dataset.risk = report.priorityAssessment.priorityLevel || '';
    score.style.setProperty('--score-angle', Math.max(0, Math.min(100, value)) * 3.6 + 'deg');
    if (report.priorityAssessment.priorityLevel) {
      const level = document.createElement('span');
      level.id = 'modal-priority-level';
      level.className = 'risk-level-pill';
      level.dataset.risk = report.priorityAssessment.priorityLevel;
      level.textContent = report.priorityAssessment.priorityLevel;
      score.closest('h4').appendChild(level);
    }
  }
  document.getElementById('report-stepper')?.remove();
  const status = report.actionStatus || report.status;
  const stages = { SUBMITTED: 0, AI_ANALYZED: 0, UNDER_REVIEW: 1, AWAITING_FIELD_VERIFICATION: 1, READY_FOR_ASSIGNMENT: 2, ASSIGNED: 2, IN_PROGRESS: 2, RESOLVED: 3, CLOSED: 3 };
  if (!Object.hasOwn(stages, status)) return; // Holds/rejections are not presented as linear progress.
  const container = document.getElementById('public-tracking');
  if (!container) return;
  const stepper = document.createElement('ol');
  stepper.id = 'report-stepper';
  stepper.className = 'report-stepper';
  stepper.setAttribute('aria-label', 'রিপোর্টের বর্তমান ধাপ');
  ['রিপোর্ট গ্রহণ', 'পর্যালোচনা', 'করণীয় পরিকল্পনা', 'সমাধান রিপোর্ট'].forEach((label, index) => {
    const step = document.createElement('li');
    step.textContent = label;
    if (index < stages[status]) step.classList.add('is-complete');
    if (index === stages[status]) step.setAttribute('aria-current', 'step');
    stepper.appendChild(step);
  });
  container.prepend(stepper);
}
const obsidianOpenDetail = openDetailModal;
openDetailModal = async function(id) {
  await obsidianOpenDetail(id);
  if (selectedReport?.id === id) decorateReportPresentation(selectedReport);
};
