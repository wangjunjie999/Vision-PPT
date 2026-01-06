I have located your repository `wangjunjie999/let-s-run-it`. To strictly follow your request to "delete all code" and replace it with your current local project, the most reliable method is to use `git` to force-push your local content, which will overwrite the remote repository.

The `mcp` tools do not support deleting all files in a repository directly. Therefore, I will use the terminal to perform the synchronization.

### Execution Plan

1.  **Configure Remote**:
    *   Add the repository `https://github.com/wangjunjie999/let-s-run-it.git` as a remote named `let_s_run_it`.
2.  **Overwrite Remote Repository**:
    *   Execute `git push --force let_s_run_it HEAD:main`.
    *   This command will:
        *   **Delete** all existing history and files in the remote `let-s-run-it` repository.
        *   **Upload** all files from your current workspace (`D:\pj\vision-configurator-pro-main_12.26`) to it.

**Note**: This requires your environment to have authentication credentials for pushing to GitHub. If not configured, the push may fail.
