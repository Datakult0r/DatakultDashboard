@echo off
cd %TEMP%\DatakultDashboard
for /f "tokens=1,* delims==" %%a in (.env.railway) do (
  railway variable set %%a=%%b --skip-deploys
)
echo Done setting variables
