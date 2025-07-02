#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawn, execSync } = require("child_process");
const os = require("os");

const GITHUB_DIR = require("path").join(require("os").homedir(), "Documents", "GitHub");

// Color definitions
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright colors
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background colors
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
};

// Style helpers
const style = {
  title: (text) => `${colors.brightCyan}${colors.bright}${text}${colors.reset}`,
  subtitle: (text) => `${colors.brightBlue}${text}${colors.reset}`,
  number: (text) =>
    `${colors.brightMagenta}${colors.bright}${text}${colors.reset}`,
  project: (text) => `${colors.brightWhite}${text}${colors.reset}`,
  selected: (text) =>
    `${colors.bgMagenta}${colors.brightWhite}${colors.bright} ${text} ${colors.reset}`,
  key: (text) => `${colors.brightYellow}${colors.bright}${text}${colors.reset}`,
  dim: (text) => `${colors.brightBlack}${text}${colors.reset}`,
  success: (text) => `${colors.brightGreen}${text}${colors.reset}`,
  error: (text) => `${colors.brightRed}${text}${colors.reset}`,
  dangerous: (text) =>
    `${colors.brightRed}${colors.bright}${text}${colors.reset}`,
  border: (text) => `${colors.brightBlack}${text}${colors.reset}`,
};

class ProjectLauncher {
  constructor() {
    this.repos = [];
    this.dangerousMode = false;
    this.originalDir = process.cwd();
    this.cursor = 0;
    this.state = 'main'; // 'main' or 'search'
    this.searchInput = '';
    this.filteredRepos = [];
    this.searchCursor = 0;
  }

  async findRepos() {
    try {
      const entries = fs.readdirSync(GITHUB_DIR, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const fullPath = path.join(GITHUB_DIR, entry.name);
          const stats = fs.statSync(fullPath);

          this.repos.push({
            name: entry.name,
            fullPath: fullPath,
            modTime: stats.mtime,
          });
        }
      }

      // Sort by modification time (newest first)
      this.repos.sort((a, b) => b.modTime - a.modTime);
    } catch (error) {
      console.error(`Error reading directory ${GITHUB_DIR}:`, error.message);
      process.exit(1);
    }
  }

  displayMenu() {
    console.clear();

    if (this.state === 'search') {
      this.displaySearchView();
      return;
    }

    // Header sized to match footer width
    const headerText = "Claude Code Launcher";
    const footerText = "[1-9] or [↑↓] navigate  •  [enter] select  •  [/] search";
    const headerWidth = footerText.length;
    const borderLine = "═".repeat(headerWidth);
    
    // Center the header text
    const padding = Math.max(0, headerWidth - headerText.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    const centeredText = " ".repeat(leftPad) + headerText + " ".repeat(rightPad);

    console.log(style.border("╭" + borderLine + "╮"));
    console.log(
      style.border("│") +
        style.title(centeredText) +
        style.border("│")
    );

    console.log(style.border("╰" + borderLine + "╯"));
    console.log("");

    // Show first 9 repos with beautiful formatting and cursor
    const displayCount = Math.min(this.repos.length, 9);

    for (let i = 0; i < displayCount; i++) {
      const repo = this.repos[i];
      const number = style.number(`${i + 1}`);
      const projectName = style.project(repo.name);
      
      if (i === this.cursor) {
        console.log(`  ${style.selected(`${i + 1}  ${repo.name}`)}`);
      } else {
        console.log(`  ${number}  ${projectName}`);
      }
    }

    if (this.repos.length > 9) {
      const extraCount = this.repos.length - 9;
      console.log("");
      console.log(
        style.dim(
          `  ... and ${extraCount} more (use ${style.key("/")} to search)`
        )
      );
    }

    // Styled options section - use same dynamic width
    console.log("");
    console.log(style.border("─".repeat(headerWidth)));
    console.log("");

    const dangerousStatus = this.dangerousMode
      ? style.dangerous("ON")
      : style.dim("off");

    console.log(
      `  ${style.key("[1-9]")} or ${style.key("[↑↓]")} navigate  •  ${style.key(
        "[enter]"
      )} select  •  ${style.key("[/]")} search`
    );
    console.log(
      `  ${style.key("[d]")} dangerous ${dangerousStatus}  •  ${style.key(
        "[q]"
      )} quit`
    );
    console.log("");
  }

  displaySearchView() {
    const headerText = "🔍 Search Projects";
    const footerText = "[↑↓] navigate  •  [enter] select  •  [esc] back  •  [backspace] delete";
    const headerWidth = footerText.length;
    const borderLine = "═".repeat(headerWidth);
    
    // Center the header text
    const padding = Math.max(0, headerWidth - headerText.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    const centeredText = " ".repeat(leftPad) + headerText + " ".repeat(rightPad);

    console.log(style.border("╭" + borderLine + "╮"));
    console.log(
      style.border("│") +
        style.title(centeredText) +
        style.border("│")
    );
    console.log(style.border("╰" + borderLine + "╯"));
    console.log("");

    // Search input
    console.log(`Search: ${style.selected(this.searchInput + "█")}`);
    console.log("");

    // Show filtered results
    if (this.filteredRepos.length === 0) {
      if (this.searchInput) {
        console.log(style.dim(`  No projects found matching "${this.searchInput}"`));
      } else {
        console.log(style.dim("  Start typing to search projects..."));
      }
    } else {
      for (let i = 0; i < this.filteredRepos.length; i++) {
        const repo = this.filteredRepos[i];
        if (i === this.searchCursor) {
          console.log(`  ${style.selected(`● ${repo.name}`)}`);
        } else {
          console.log(`  ${style.project(`○ ${repo.name}`)}`);
        }
      }
    }

    console.log("");
    console.log(style.border("─".repeat(headerWidth)));
    console.log("");
    console.log(
      `  ${style.key("[↑↓]")} navigate  •  ${style.key(
        "[enter]"
      )} select  •  ${style.key("[esc]")} back  •  ${style.key(
        "[backspace]"
      )} delete`
    );
    console.log("");
  }

  filterRepos() {
    if (!this.searchInput) {
      this.filteredRepos = [...this.repos];
    } else {
      const searchLower = this.searchInput.toLowerCase();
      this.filteredRepos = this.repos.filter(repo =>
        repo.name.toLowerCase().includes(searchLower)
      );
    }
    
    // Ensure cursor is within bounds
    if (this.filteredRepos.length === 0) {
      this.searchCursor = 0;
    } else if (this.searchCursor >= this.filteredRepos.length) {
      this.searchCursor = this.filteredRepos.length - 1;
    } else if (this.searchCursor < 0) {
      this.searchCursor = 0;
    }
  }

  async launchClaude(repo) {
    try {
      // Restore normal terminal mode
      process.stdin.setRawMode(false);
      process.stdin.pause();
      
      // Change to project directory
      process.chdir(repo.fullPath);

      const command = this.dangerousMode 
        ? 'claude --dangerously-skip-permissions'
        : 'claude';
      
      // Clear screen and execute claude synchronously
      process.stdout.write('\x1b[2J\x1b[0;0H'); // Clear screen and move cursor to top
      
      try {
        execSync(command, { 
          cwd: repo.fullPath,
          stdio: 'inherit'
        });
        process.chdir(this.originalDir);
        process.exit(0);
      } catch (error) {
        process.chdir(this.originalDir);
        process.exit(error.status || 1);
      }
      
    } catch (error) {
      console.error("Error changing directory:", error.message);
      process.exit(1);
    }
  }

  setupKeyboardInput() {
    // Set up raw mode for immediate key capture
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key) => {
      this.handleKeyPress(key);
    });
  }

  async handleKeyPress(key) {
    const keyStr = key.toString();
    
    // Handle Ctrl+C
    if (keyStr === '\u0003') {
      process.stdin.setRawMode(false);
      console.clear();
      process.exit(0);
    }

    if (this.state === 'search') {
      await this.handleSearchKeys(keyStr);
    } else {
      await this.handleMainKeys(keyStr);
    }

    this.displayMenu();
  }

  async handleMainKeys(key) {
    const displayCount = Math.min(this.repos.length, 9);
    
    switch (key) {
      case '\u001b[A': // Up arrow
        if (this.cursor > 0) {
          this.cursor--;
        }
        break;
        
      case '\u001b[B': // Down arrow
        if (this.cursor < displayCount - 1) {
          this.cursor++;
        }
        break;
        
      case '\r': // Enter
        await this.launchClaude(this.repos[this.cursor]);
        break;
        
      case '/': // Search
        this.state = 'search';
        this.searchInput = '';
        this.filterRepos();
        break;
        
      case 'd': // Dangerous mode toggle
        this.dangerousMode = !this.dangerousMode;
        break;
        
      case 'q': // Quit
        process.stdin.setRawMode(false);
        console.clear();
        process.exit(0);
        break;
        
      default:
        // Handle number keys 1-9
        const num = parseInt(key);
        if (num >= 1 && num <= displayCount) {
          this.cursor = num - 1;
          await this.launchClaude(this.repos[this.cursor]);
        }
        break;
    }
  }

  async handleSearchKeys(key) {
    switch (key) {
      case '\u001b': // Escape
        this.state = 'main';
        this.searchInput = '';
        break;
        
      case '\u001b[A': // Up arrow
        if (this.searchCursor > 0) {
          this.searchCursor--;
        }
        break;
        
      case '\u001b[B': // Down arrow
        if (this.searchCursor < this.filteredRepos.length - 1) {
          this.searchCursor++;
        }
        break;
        
      case '\r': // Enter
        if (this.filteredRepos.length > 0) {
          await this.launchClaude(this.filteredRepos[this.searchCursor]);
        }
        break;
        
      case '\u007f': // Backspace
        if (this.searchInput.length > 0) {
          this.searchInput = this.searchInput.slice(0, -1);
          this.filterRepos();
        }
        break;
        
      default:
        // Add printable characters to search
        if (key.length === 1 && key >= ' ' && key <= '~') {
          this.searchInput += key;
          this.filterRepos();
        }
        break;
    }
  }

  async run() {
    await this.findRepos();

    if (this.repos.length === 0) {
      console.log(`No directories found in ${GITHUB_DIR}`);
      process.exit(1);
    }

    this.setupKeyboardInput();
    this.displayMenu();

    // Keep the process alive
    process.stdin.on('end', () => {
      process.exit(0);
    });
  }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  console.clear();
  process.exit(0);
});

// Run the launcher
const launcher = new ProjectLauncher();
launcher.run().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
