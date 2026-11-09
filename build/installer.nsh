; NOTE(0913vision): The assisted uninstaller accepts --delete-app-data even
; when deleteAppDataOnUninstall is false. Reject it before any removal.
!macro customUnInit
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${IfNot} ${Errors}
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${If} ${isUpdated}
        StrCpy $1 "--updated"
      ${Else}
        StrCpy $1 ""
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  !define MUI_FINISHPAGE_LINK "주일 테마 글꼴(KoPub) 받기"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://www.kopus.org/biz-electronic-font2/"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW LLPFinishPageShow
  !insertmacro MUI_PAGE_FINISH

  Function LLPFinishPageShow
    ${IfNot} ${RebootFlag}
      !ifndef HIDE_RUN_AFTER_FINISH
        !insertmacro LLPFinishControlPosition $mui.FinishPage.Link 90
        !insertmacro LLPFinishControlPosition $mui.FinishPage.Run 110
      !endif
    ${EndIf}
  FunctionEnd
!macroend

; NOTE(0913vision): Map dialog units to pixels so the font link remains above
; the existing run checkbox at the user's DPI without replacing its behavior.
!macro LLPFinishControlPosition CONTROL TOP
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  System::Call '*(i 120, i ${TOP}, i 195, i 10) p.r0'
  System::Call 'user32::MapDialogRect(p $mui.FinishPage, p r0)'
  System::Call '*$0(i.r1, i.r2, i.r3, i.r4)'
  System::Free $0
  System::Call 'user32::MoveWindow(p ${CONTROL}, i r1, i r2, i r3, i r4, i 1)'
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend
