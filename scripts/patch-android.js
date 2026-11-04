// Adds the permissions needed for habit alarms + notifications to the generated AndroidManifest.xml
const fs = require('fs');
const f = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(f, 'utf8');
const perms = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
  'android.permission.RECEIVE_BOOT_COMPLETED'
];
const add = perms
  .filter(p => !x.includes(`"${p}"`))
  .map(p => `    <uses-permission android:name="${p}" />`)
  .join('\n');
if (add) x = x.replace('</manifest>', add + '\n</manifest>');
fs.writeFileSync(f, x);
console.log('Manifest patched:', add ? 'added permissions' : 'already ok');
