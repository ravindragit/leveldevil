# Level Devil - Web Game

A web-based platformer game inspired by Level Devil, featuring deceptive level design and unexpected obstacles that appear during gameplay!

## 🎮 Features

### Core Gameplay
- **Smooth Physics**: Realistic gravity, jumping, and collision detection
- **Multiple Levels**: 5 challenging levels with increasing difficulty
- **Death Counter**: Tracks how many times you've died
- **Responsive Controls**: Arrow keys and space bar for movement
- **🎲 RANDOM VARIATIONS**: Every time you restart or refresh, levels change! Keep you on your toes with unpredictable obstacle positions and behaviors

### Dynamic & Unexpected Obstacles (Level Devil Style!)

#### 1. **Position-Triggered Traps** 🎯
- Spikes and obstacles suddenly appear when you reach certain positions
- The game watches where you are and triggers surprises at key moments
- Creates an element of surprise and forces players to be cautious

#### 2. **Falling Blocks from Ceiling** 📦
- Heavy blocks fall from above when triggered
- Warning lines show where blocks will fall (briefly)
- Forces players to keep moving and react quickly

#### 3. **Disappearing Platforms** 👻
- Platforms that start blinking when you step on them
- After a short delay, they vanish completely
- Must time your jumps carefully to avoid falling

#### 4. **Time-Based Surprises** ⏰
- Obstacles appear after spending too much time in a level
- Encourages quick thinking and speedrunning
- Adds pressure to already difficult situations

#### 5. **Fake Platforms** 🕳️
- Platforms that look solid but you fall right through them
- Visually similar to real platforms to trick players
- Tests observation and memory

#### 6. **Moving Platforms** 🔄
- Platforms that move horizontally or vertically
- Players must time their jumps perfectly
- Combined with other obstacles for extra difficulty

#### 7. **Fake Goal (Level 5 Only)** 😈
- The goal door moves up when you get close to it!
- Ultimate trolling mechanic
- Forces players to find an alternate route

## 🎯 Level Breakdown

### Level 1: Tutorial
- Basic platforming
- Learn the controls
- No tricks yet!

### Level 2: The Fake Out
- Introduces fake platforms
- Position-triggered spikes appear as you progress
- Time-based spike appears after 3 seconds

### Level 3: Moving Troubles
- Moving platforms over spike field
- Falling block drops when you reach the middle
- Timing is everything!

### Level 4: The Trap
- Combination of moving platforms, fake platforms, and disappearing platforms
- Platforms disappear when you touch them
- Position-triggered spikes
- Multi-layered vertical challenge

### Level 5: Devil's Playground
- ALL mechanics combined
- Multiple falling blocks
- Multiple position-triggered spikes
- Two disappearing platforms
- **FAKE GOAL** that moves away when approached!
- The ultimate test of skill and patience

## 🎮 Controls

- **← → Arrow Keys**: Move left/right
- **Space / ↑ Arrow**: Jump
- **R Key**: Restart current level
- **P / Esc**: Pause
- **M**: Mute
- **L**: Level Select
- **F**: Fullscreen
- **V**: Reduced Motion
- **H**: HUD
- **C**: Clear saved stats/settings

## 🚀 How to Play

1. Open `index.html` in any modern web browser
2. Use arrow keys to move and space to jump
3. Reach the green door to complete each level
4. Watch out for unexpected obstacles!
5. Be prepared to die... a lot 💀

### 🔗 Jump to Specific Level (URL Parameters)

You can start at any level by adding `?level=X` to the URL:

- **Level 1 (Tutorial)**: `index.html?level=1`
- **Level 2 (The Fake Out)**: `index.html?level=2`
- **Level 3 (Moving Troubles)**: `index.html?level=3`
- **Level 4 (The Trap)**: `index.html?level=4`
- **Level 5 (Devil's Playground)**: `index.html?level=5`

**Examples:**
- `file:///path/to/leveldevil/index.html?level=3` - Start at Level 3
- `http://localhost:8000/index.html?level=5` - Start at Level 5 (if using a server)

Perfect for testing and practicing specific levels!

## 🎨 Visual Effects

- **Dynamic Spikes**: Glow red when they appear
- **Falling Blocks**: Orange warning lines show fall trajectory
- **Disappearing Platforms**: Blink before vanishing
- **Smooth Animations**: 60 FPS gameplay
- **Modern UI**: Gradient backgrounds and glowing effects

## 🎲 Randomization System

Every time you play a level (restart with R or refresh the page), the game **randomizes elements** to keep it fresh and exciting!

### What Gets Randomized:

**Global Randomization (All Levels 2-5):**
- 🎯 **Spike Positions**: Shift ±20 pixels from original position
- ⚡ **Dynamic Spike Locations**: Move ±30 pixels horizontally, ±15 pixels vertically
- 📦 **Falling Block Drop Points**: Shift ±40 pixels
- 🎬 **Trigger Positions**: Move ±30 pixels (changes when surprises activate!)
- 🏃 **Moving Platform Speeds**: Vary ±20% from base speed
- 🎰 **Fake Platforms**: 30% chance to randomly become SOLID (surprise!)

**Level-Specific Variations:**

- **Level 2 (The Fake Out)**: Fake platform randomly positioned in 3 different spots
- **Level 3 (Moving Troubles)**: 30% of spike field randomly removed
- **Level 4 (The Trap)**: Disappearing platforms vanish at different speeds (0.8x, 1.0x, or 1.3x)
- **Level 5 (Devil's Playground)**: 
  - 25% of ground spikes randomly removed
  - Moving platform ranges vary ±20%

### Why This Is Awesome:

✨ **Infinite Replayability** - No two runs are exactly the same  
🎮 **Keeps You Alert** - Can't memorize exact positions  
😈 **More Trolling** - That fake platform might actually be solid this time!  
🏆 **True Skill Test** - Adapt to changing conditions  

**Note:** Level 1 (Tutorial) is never randomized to keep the learning experience consistent.

## 🔧 Technical Features

- Pure vanilla JavaScript (no frameworks)
- Canvas-based rendering
- Smooth 60 FPS game loop
- Collision detection system
- Trigger-based event system
- State management for dynamic obstacles

## 🎭 Level Devil Philosophy

Like the original Level Devil, this game is designed to:
- Surprise and troll the player
- Create memorable "gotcha" moments
- Reward careful observation and quick reflexes
- Make you laugh (or cry) when you die
- Provide satisfaction when you finally beat a level

## 📝 Notes

- All obstacles reset when you restart a level
- The game saves your death count across levels
- Best per-level time and best run deaths are saved locally
- Last played level is remembered (when no `?level=` is provided)
- Congratulations screen appears after beating all 5 levels
- Death counter never resets (embrace the pain!)

Enjoy the frustration! 😈

