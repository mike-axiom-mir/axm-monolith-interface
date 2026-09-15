$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
node .\axm-external-chat-relay.js
