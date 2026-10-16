@echo off
rem spidey - command-line manual for Spidey Sense.   Usage: spidey help | commands | features | search <word> | docs
setlocal
set "APP=%~dp0Spidey Sense.exe"
if not exist "%APP%" (
  echo Spidey Sense.exe was not found next to this file.
  exit /b 1
)
set ELECTRON_RUN_AS_NODE=1
set "SPIDEY_RES=%~dp0resources"
if defined WT_SESSION set FORCE_COLOR=1
rem the app is a GUI program; piping its output is what makes it appear in this console
"%APP%" "%~dp0resources\app.asar\bin\spidey.js" %* | findstr /v /c:"@@never@@"
exit /b %ERRORLEVEL%
