; MoneyCapy - Custom NSIS uninstaller script
; Prompts user about data deletion options during uninstall

!macro customUnInstall
  ; Step 1: ask if user wants to delete any data
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove MoneyCapy data?$\n(database with items, income, accounts, cards, etc.)$\n$\nClick NO to keep all your data." IDNO un_keep_data

  ; Step 2: ask if user wants to delete everything or only the database
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove EVERYTHING, including settings and passwords?$\n$\nClick YES to delete everything.$\nClick NO to delete only the database (settings kept)." IDYES un_delete_all

  ; Option 2: delete only database files
  Delete "$APPDATA\moneycapy\*.db"
  Delete "$APPDATA\moneycapy\*.sqlite"
  Goto un_keep_data

  un_delete_all:
  ; Option 3: delete all user data (database + settings)
  RMDir /r "$APPDATA\moneycapy"

  un_keep_data:
  ; Option 1: keep all data (no action needed)
!macroend
