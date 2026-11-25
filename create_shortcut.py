import os

vbs = r'''Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "C:\Users\Administrator\Desktop\六本豆4.1.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "C:\Users\Administrator\Desktop\4001B~1.1\C94A~1.EXE"
oLink.WorkingDirectory = "C:\Users\Administrator\Desktop\4001B~1.1"
oLink.Description = "六本豆 4.1"
oLink.Save
'''

vbs_path = r"C:\Users\Administrator\Desktop\liubendou-v4\create_shortcut.vbs"
with open(vbs_path, "w", encoding="gbk") as f:
    f.write(vbs)

print("VBS written, running cscript...")
os.system(f'cscript //nologo "{vbs_path}"')
lnk_path = r"C:\Users\Administrator\Desktop\六本豆4.1.lnk"
print("LNK exists:", os.path.exists(lnk_path))

