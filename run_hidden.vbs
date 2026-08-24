Option Explicit

Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

' Project directory
WshShell.CurrentDirectory = "G:\OMARA\Desktop\ALKABEER VIP WEB"

' Start API silently
WshShell.Run "cmd /c npm run start:api", 0, False

' Start Web silently
WshShell.Run "cmd /c npm run start:web", 0, False

' Wait for services to start
WScript.Sleep 5000

' Open application
WshShell.Run "http://localhost:5173", 1, False

Set WshShell = Nothing