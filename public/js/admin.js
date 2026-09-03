// Confirm before any destructive form submission marked with data-confirm.
document.addEventListener('submit', function (e) {
  var form = e.target;
  if (form.hasAttribute && form.hasAttribute('data-confirm')) {
    if (!window.confirm(form.getAttribute('data-confirm'))) {
      e.preventDefault();
    }
  }
});

// Live preview of a newly chosen photo on the add/edit fragrance form.
(function () {
  var fileInput = document.querySelector('input[type="file"][name="image"]');
  if (!fileInput) return;

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;

    var preview = document.querySelector('.current-image');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'current-image';
      preview.innerHTML = '<img alt="Selected photo preview"><span></span>';
      fileInput.insertAdjacentElement('afterend', preview);
    }

    var img = preview.querySelector('img');
    var label = preview.querySelector('span');
    var reader = new FileReader();
    reader.onload = function (e) { img.src = e.target.result; };
    reader.readAsDataURL(file);
    if (label) label.textContent = 'New photo selected — save to apply.';
  });
})();
