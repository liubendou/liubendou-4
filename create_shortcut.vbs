Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "C:\Users\Administrator\Desktop\Áù±¾¶¹4.1.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "C:\Users\Administrator\Desktop\4001B~1.1\C94A~1.EXE"
oLink.WorkingDirectory = "C:\Users\Administrator\Desktop\4001B~1.1"
oLink.Description = "Áù±¾¶¹ 4.1"
oLink.Save
