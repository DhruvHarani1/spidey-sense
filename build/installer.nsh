; Extra NSIS steps for Spidey Sense (included via nsis.include).
!macro customInit
  ; Reinstall/update into the folder it is already installed in, never a second copy.
  ReadRegStr $R2 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${If} $R2 != ""
    ${If} ${FileExists} "$R2\${APP_EXECUTABLE_FILENAME}"
      StrCpy $INSTDIR "$R2"
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ; Remove the "launch at startup" entry so uninstalling leaves nothing running at login.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SpideySense"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Spidey Sense"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Spidey Sense"
!macroend
