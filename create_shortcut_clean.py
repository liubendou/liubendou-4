import os, subprocess

ps_code = """
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('C:\\Users\\Administrator\\Desktop\\temp41.lnk')
$Shortcut.TargetPath = 'C:\\Users\\Administrator\\Desktop\\4001B~1.1\\C94A~1.EXE'
$Shortcut.WorkingDirectory = 'C:\\Users\\Administrator\\Desktop\\4001B~1.1'
$Shortcut.Description = '六本豆 4.1'
$Shortcut.Save()
"""

with open(r"C:\Users\Administrator\Desktop\liubendou-v4\make_temp.ps1", "w", encoding="utf-8") as f:
    f.write(ps_code)

res = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", r"C:\Users\Administrator\Desktop\liubendou-v4\make_temp.ps1"], capture_output=True, text=True)
print("PS STDOUT:", res.stdout)
print("PS STDERR:", res.stderr)

src = r"C:\Users\Administrator\Desktop\temp41.lnk"
dst = r"C:\Users\Administrator\Desktop\六本豆4.1.lnk"
if os.path.exists(src):
    if os.path.exists(dst):
        os.remove(dst)
    os.rename(src, dst)
    print("SUCCESS! Created:", os.path.exists(dst))
else:
    print("FAILED: temp41.lnk was not created")

