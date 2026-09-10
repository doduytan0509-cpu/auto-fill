@echo off
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.Environment]::GetFolderPath('Desktop') + '\Auto-Fill.lnk'); $Shortcut.TargetPath = '%~dp0start.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Save()"
echo Da tao Shortcut "Auto-Fill" ngoai man hinh Desktop!
