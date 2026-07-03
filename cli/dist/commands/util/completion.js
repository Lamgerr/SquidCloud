export default async function completion(shell) {
    switch (shell) {
        case 'bash':
            console.log('# Generate bash completion with: squidcloud completion bash > /etc/bash_completion.d/squidcloud');
            console.log(`
_squidcloud_completions() {
  local cur prev opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  opts="login logout whoami auth storage deploy sites scripts filereq time collab sign monitor logs doctor version config completion feedback update"
  COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
  return 0
}
complete -F _squidcloud_completions squidcloud
`);
            break;
        case 'zsh':
            console.log('#compdef squidcloud');
            console.log(`
_squidcloud() {
  local line
  _arguments -C \\
    "-v[Show version]" \\
    "--version[Show version]" \\
    "--output[Output format]:format:(text json)" \\
    "1: :(login logout whoami auth storage deploy sites scripts filereq time collab sign monitor logs doctor version config completion feedback update)" \\
    "*::arg:->args"
  case $line[1] in
    auth) _arguments "2: :(status sessions revoke)" ;;
    storage) _arguments "2: :(ls upload download cp mv rm mkdir cat info share unshare tag search diff clean)" ;;
    sites) _arguments "2: :(list info open unpublish delete visibility rename rollback deploys logs analytics purge)" ;;
    scripts) _arguments "2: :(list run logs validate init enable disable delete status cancel watch)" ;;
    filereq) _arguments "2: :(list create info submissions export clear delete embed)" ;;
    time) _arguments "2: :(lock unlock status list proof)" ;;
    collab) _arguments "2: :(invite list remove activity leave transfer)" ;;
    sign) _arguments "2: :(request status list cancel verify download)" ;;
    monitor) _arguments "2: :(sites pipelines storage automations)" ;;
    logs) _arguments "2: :(tail search export)" ;;
    config) _arguments "2: :(list set get delete reset)" ;;
  esac
}
compdef _squidcloud squidcloud
`);
            break;
        case 'fish':
            console.log('complete -c squidcloud -f');
            console.log('complete -c squidcloud -l output -r -f -a "text json"');
            console.log('complete -c squidcloud -n "__fish_use_subcommand" -a "login logout whoami auth"');
            console.log('complete -c squidcloud -n "__fish_use_subcommand" -a "storage deploy sites scripts filereq"');
            console.log('complete -c squidcloud -n "__fish_use_subcommand" -a "time collab sign monitor logs"');
            console.log('complete -c squidcloud -n "__fish_use_subcommand" -a "doctor version config completion feedback update"');
            break;
        case 'powershell':
            console.log(`
Register-ArgumentCompleter -Native -CommandName 'squidcloud' -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $commands = @('login', 'logout', 'whoami', 'auth', 'storage', 'deploy', 'sites', 'scripts', 'filereq', 'time', 'collab', 'sign', 'monitor', 'logs', 'doctor', 'version', 'config', 'completion', 'feedback', 'update')
  $commandAst.CommandElements | Select-Object -Skip 1 | ForEach-Object { $wordToComplete = $_ }
  $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}
`);
            break;
        default:
            console.error(`Unknown shell: ${shell}. Supported: bash, zsh, fish, powershell`);
            process.exit(1);
    }
}
//# sourceMappingURL=completion.js.map