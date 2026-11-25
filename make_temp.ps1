
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('C:\Users\Administrator\Desktop\temp41.lnk')
$Shortcut.TargetPath = 'C:\Users\Administrator\Desktop\4001B~1.1\C94A~1.EXE'
$Shortcut.WorkingDirectory = 'C:\Users\Administrator\Desktop\4001B~1.1'
$Shortcut.Description = '六本豆 4.1'
$Shortcut.Save()
