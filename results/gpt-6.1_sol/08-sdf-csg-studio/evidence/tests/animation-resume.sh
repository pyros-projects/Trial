$B focus '#animation-time'
$B press Home
$B press ArrowRight
$B press ArrowRight
$B press ArrowRight
$B press Tab
$B eval 'FieldStudio.getScene().animation' > evidence/logs/animation-time-input.json
$B screenshot evidence/screenshots/33-animation-controls.png
$B click '#tab-render'
$B focus '#settings-steps'
$B press Home
$B press ArrowRight
$B press ArrowRight
$B focus '#settings-fov'
$B press Home
$B press ArrowRight
$B press ArrowRight
$B focus '#settings-exposure'
$B press End
$B press ArrowLeft
$B press Tab
$B eval 'FieldStudio.getScene().settings' > evidence/logs/keyboard-quality-settings.json
$B errors > evidence/logs/animation-errors.txt
