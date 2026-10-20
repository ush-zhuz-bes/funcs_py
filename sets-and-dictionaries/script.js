// Жиындар мен сөздіктер — статикалық оқу сайты
// Тек навигация, тест жауаптарын ашу, нұсқа таңдау, көшіру және басып шығару үшін.

document.addEventListener('DOMContentLoaded', function () {
  initMainTabs();
  initSubTabs();
  initQuizReveal();
  initCopyButtons();
  initVariantPicker();
  initPrintButtons();
});

/* ---------- Негізгі қойындылар (Практикалық / Зертханалық) ---------- */
function initMainTabs() {
  var tabButtons = document.querySelectorAll('.tab-btn');
  var tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-tab');

      tabButtons.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      tabPanels.forEach(function (panel) {
        panel.classList.toggle('active', panel.id === target);
      });
    });
  });
}

/* ---------- Ішкі қойындылар (1-4 және 5-6 бөлімдер) ---------- */
function initSubTabs() {
  var tabPanels = document.querySelectorAll('.tab-panel');

  tabPanels.forEach(function (panel) {
    var subButtons = panel.querySelectorAll('.sub-btn');
    var subPanels = panel.querySelectorAll('.sub-panel');

    subButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-sub');

        subButtons.forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');

        subPanels.forEach(function (sp) {
          sp.classList.toggle('active', sp.id === target);
        });
      });
    });
  });
}

/* ---------- Тест жауаптарын ашу/жасыру ---------- */
function initQuizReveal() {
  var revealButtons = document.querySelectorAll('.reveal-btn');

  revealButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-target');
      var answer = document.getElementById(targetId);
      if (!answer) return;

      var isHidden = answer.hasAttribute('hidden');
      if (isHidden) {
        answer.removeAttribute('hidden');
        btn.textContent = 'Жасыру';
      } else {
        answer.setAttribute('hidden', '');
        btn.textContent = 'Тексеру';
      }
    });
  });
}

/* ---------- Кодты көшіру ---------- */
function initCopyButtons() {
  var copyButtons = document.querySelectorAll('.copy-btn');

  copyButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-copy-target');
      var codeEl = document.getElementById(targetId);
      if (!codeEl) return;

      var text = codeEl.textContent;
      copyTextToClipboard(text, function (success) {
        var originalText = btn.textContent;
        btn.textContent = success ? 'Көшірілді!' : 'Көшіру сәтсіз';
        btn.classList.toggle('copied', success);
        setTimeout(function () {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 1500);
      });
    });
  });
}

function copyTextToClipboard(text, callback) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      function () { callback(true); },
      function () { fallbackCopy(text, callback); }
    );
  } else {
    fallbackCopy(text, callback);
  }
}

function fallbackCopy(text, callback) {
  var textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  var success = false;
  try {
    success = document.execCommand('copy');
  } catch (err) {
    success = false;
  }
  document.body.removeChild(textarea);
  callback(success);
}

/* ---------- Зертханалық нұсқа таңдау ---------- */
var VARIANT_STORAGE_KEY = 'setsDictsLesson.selectedVariant';

function initVariantPicker() {
  var variantButtons = document.querySelectorAll('.variant-btn[data-variant]');
  var randomBtn = document.getElementById('randomVariantBtn');
  var label = document.getElementById('selectedVariantLabel');
  var placeholder = document.getElementById('variantPlaceholder');
  var panels = document.querySelectorAll('.variant-panel[data-variant-panel]');

  function selectVariant(n) {
    variantButtons.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-variant') === String(n));
    });

    panels.forEach(function (panel) {
      var match = panel.getAttribute('data-variant-panel') === String(n);
      panel.toggleAttribute('hidden', !match);
    });

    if (placeholder) {
      placeholder.setAttribute('hidden', '');
    }

    if (label) {
      label.innerHTML = 'Таңдалған нұсқа: <strong>' + n + '</strong>';
    }

    try {
      localStorage.setItem(VARIANT_STORAGE_KEY, String(n));
    } catch (err) {
      /* localStorage қолжетімсіз болса, жай ештеңе сақталмайды */
    }
  }

  variantButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectVariant(btn.getAttribute('data-variant'));
    });
  });

  if (randomBtn) {
    randomBtn.addEventListener('click', function () {
      var n = Math.floor(Math.random() * 8) + 1;
      selectVariant(n);
    });
  }

  var saved = null;
  try {
    saved = localStorage.getItem(VARIANT_STORAGE_KEY);
  } catch (err) {
    saved = null;
  }

  if (saved && saved >= '1' && saved <= '8') {
    selectVariant(saved);
  }
}

/* ---------- Басып шығару ---------- */
function initPrintButtons() {
  var printButtons = document.querySelectorAll('.print-btn');
  printButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.print();
    });
  });
}
