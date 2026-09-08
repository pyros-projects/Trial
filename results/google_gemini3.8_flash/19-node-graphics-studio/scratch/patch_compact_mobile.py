with open('scratch/gen_css.py', 'r') as f:
    css = f.read()

extra_mobile = """
@media (max-width: 600px) {
  header#top-bar {
    padding: 0 6px;
    gap: 4px;
  }
  .brand span:not(.brand-badge) {
    display: none;
  }
  #preset-select {
    min-width: 110px !important;
    max-width: 130px !important;
  }
  .timeline-toolbar {
    padding: 0 6px;
    gap: 4px;
    overflow-x: auto;
    white-space: nowrap;
  }
  .timeline-toolbar > * {
    flex-shrink: 0;
  }
}
"""

css += extra_mobile

with open('scratch/gen_css.py', 'w') as f:
    f.write(css)

print("Compact mobile CSS added.")
