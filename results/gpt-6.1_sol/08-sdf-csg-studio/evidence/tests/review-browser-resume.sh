$B select '#settings-resolution' 0.5
$B set viewport 1280 800
$B click '#reset-camera'
$B eval 'window.__validationTag="sdf-sol61-08-validation";window._beforeWheel=FieldStudio.getScene().camera.distance'
node evidence/tests/native-cdp.cjs wheel
$B wait --fn 'FieldStudio.getScene().camera.distance !== window._beforeWheel'
$B eval '({before:window._beforeWheel,after:FieldStudio.getScene().camera.distance})' > evidence/logs/native-wheel.json
node evidence/tests/native-cdp.cjs clipboard
$B click '#open-export'
$B click '#copy-json'
$B wait --fn 'document.getElementById("toast").textContent.includes("copied")'
$B eval 'navigator.clipboard.readText().then(text=>({length:text.length,equals:text===SceneCore.serialize(FieldStudio.getScene())}))' > evidence/logs/native-clipboard.json
$B press Escape
