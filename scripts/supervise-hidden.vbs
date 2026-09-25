' Launch the Auto supervisor with no console window.
' wscript.exe is a GUI host, so the scheduled task has nothing to close.
' Window style 0 hides node.exe; True waits so the task stays running.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("Wscript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(scriptDir)
sh.CurrentDirectory = root

node = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not fso.FileExists(node) Then
  Set exec = sh.Exec("where.exe node")
  node = Trim(exec.StdOut.ReadLine())
End If

supervise = fso.BuildPath(scriptDir, "supervise.mjs")
code = sh.Run("""" & node & """ """ & supervise & """", 0, True)
WScript.Quit code
