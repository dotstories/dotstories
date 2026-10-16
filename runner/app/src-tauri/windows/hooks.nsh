; Uninstaller hooks (Tauri NSIS: bundle > windows > nsis > installerHooks).
;
; Fast uninstall. The data folder holds Python, the AI libraries and the models: tens of thousands
; of files and many GB. Tauri deletes them one by one and lists every file, which takes minutes.
; Instead, when "Delete the application data" is ticked: rename the folder (instant) and let Windows
; delete it in the background, without a window. If the rename fails (a file still in use), the
; folder stays where it was and Tauri's normal delete still runs after this hook.

Var DotStoriesTries

!macro DOTSTORIES_TRASH DIR
  ${If} ${FileExists} "${DIR}\*.*"
  ${AndIfNot} ${FileExists} "${DIR}.deleting\*.*"
    ; The engine stops a moment after the app (it watches the app): retry for a few seconds.
    StrCpy $DotStoriesTries 0
    ${Do}
      ClearErrors
      Rename "${DIR}" "${DIR}.deleting"
      ${IfNot} ${Errors}
        ExecShell "" "$SYSDIR\cmd.exe" '/c rd /s /q "${DIR}.deleting"' SW_HIDE
        ${Break}
      ${EndIf}
      IntOp $DotStoriesTries $DotStoriesTries + 1
      Sleep 1000
    ${LoopUntil} $DotStoriesTries >= 5
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    ; The app must be closed first, or its files are in use and can't be moved.
    !insertmacro CheckIfAppIsRunning "$INSTDIR\${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
    SetShellVarContext current
    !insertmacro DOTSTORIES_TRASH "$LOCALAPPDATA\${BUNDLEID}"
    !insertmacro DOTSTORIES_TRASH "$APPDATA\${BUNDLEID}"
  ${EndIf}
!macroend
