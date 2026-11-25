const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const script = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('C:\\Users\\Administrator\\Desktop\\六本豆4.1.lnk')
$Shortcut.TargetPath = 'C:\\Users\\Administrator\\Desktop\\六本豆4.1\\六本豆.exe'
$Shortcut.WorkingDirectory = 'C:\\Users\\Administrator\\Desktop\\六本豆4.1'
$Shortcut.Description = '六本豆 4.1 · 10亿旗舰心理分析对话模型桌面端'
$Shortcut.Save()
`;

const b64 = Buffer.from(script, 'utf16le').toString('base64');
execSync(`powershell.exe -NoProfile -EncodedCommand ${b64}`, { stdio: 'inherit' });

console.log('Shortcut exists:', fs.existsSync('C:\\Users\\Administrator\\Desktop\\六本豆4.1.lnk'));

