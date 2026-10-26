<div align="center">

# 🖥️ INSTRUCTION CYCLE SIMULATOR

### *Visualize • Understand • Master*

**From Instruction to Execution — Step by Step!**

<br>

[![Live Demo](https://img.shields.io/badge/▶_LIVE_SIMULATOR-Click_to_Launch-ff9800?style=for-the-badge)](https://sharonpeter669966-bit.github.io/INSTRUCTION-CYCLE-SIMULATORR/)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-2f9e44?style=flat-square)

### 🔗 **[https://sharonpeter669966-bit.github.io/INSTRUCTION-CYCLE-SIMULATORR/](https://sharonpeter669966-bit.github.io/INSTRUCTION-CYCLE-SIMULATORR/)**

</div>

---

## 💡 What is an Instruction Cycle?

Every program your computer runs is just a long list of tiny instructions. The CPU handles them one at a time, over and over, using a repeating routine called the **instruction cycle**:

> Fetch the instruction from memory, understand it, perform the operation, and update the CPU state.

This project **brings that invisible process to life**. You write a small assembly program, press a button, and watch a simplified CPU work through it, one stage at a time.

---

## 🔄 The 5 Stages

Every instruction in this simulator passes through **all five stages**, with no skipping. Even an instruction like `ADD` that never touches data memory still goes through the Memory Access stage as a pass-through, so you can see the full pipeline of the cycle every time.

| # | Stage | What happens | Notation |
|---|-------|--------------|----------|
| 1 | 🌸 **Fetch** | Read the instruction from program memory using the PC | `IR ← Memory[PC]` |
| 2 | 🌼 **Decode** | Control Unit identifies the opcode and operands and sets control signals | `CU ← opcode` |
| 3 | 🌿 **Execute** | ALU performs the arithmetic / logic operation and updates the flags | `ALU ← op(a, b)` |
| 4 | 💧 **Memory Access** | LOAD reads and STORE writes data memory (others pass through) | `Mem[addr] ↔ reg` |
| 5 | 💜 **Write Back** | Result is written to the register and the PC is updated | `Rd ← result, PC ← next` |

---

## ✨ Features

- ⏯️ **Step Stage**: advance one single stage at a time (best for learning)
- ⏭️ **Step Instruction**: complete all 5 stages of one instruction at once
- ⏩ **Run / Pause / Reset**: continuous execution with an adjustable speed slider
- 🧩 **Live datapath diagram**: Program Memory → IR → Control Unit → ALU → Data Memory lights up as each stage runs
- 🗃️ **Registers R0–R3**: shown in decimal, hex and binary, with a flash animation when they change
- 🚩 **Status flags**: Zero (Z), Carry (C) and Sign (S) update after ALU operations
- 📜 **Program memory view**: the PC arrow points at the next instruction
- 💾 **Data memory grid**: 16 cells that glow on reads and writes
- 🔍 **Current instruction panel**: opcode, operands, control signals, ALU operation, result and memory action
- 📝 **Execution log**: a colour-coded, stage-by-stage record of everything the CPU does
- 🧠 **Plain-English explanations**: every step is explained in words as it happens
- ✏️ **Editable programs**: write your own assembly, with labels and `;` comments, and get helpful error messages

---

## 📖 Instruction Set

| Instruction | Meaning |
|-------------|---------|
| `MOV R1, 5` / `MOV R1, R2` | Load an immediate value / copy a register |
| `ADD R1, R2, R3` | R1 ← R2 + R3 |
| `SUB R1, R2, R3` | R1 ← R2 − R3 |
| `AND R1, R2, R3` | R1 ← R2 AND R3 |
| `OR R1, R2, R3` | R1 ← R2 OR R3 |
| `LOAD R1, [4]` | R1 ← DataMemory[4] |
| `STORE R1, [4]` | DataMemory[4] ← R1 |
| `JUMP label` | PC ← target instruction |
| `JZ label` | Jump only if the Zero flag = 1 *(bonus instruction)* |
| `HALT` | Stop the CPU |

> Registers are **8-bit** (0–255). Values wrap around on overflow and set the Carry flag. Data memory has **16 cells** (addresses 0–15).

---

## 🚀 Quick Start

### Option 1: Just click
Open the **[live simulator](https://sharonpeter669966-bit.github.io/INSTRUCTION-CYCLE-SIMULATORR/)**. Nothing to install.

### Option 2: Run it locally
```bash
git clone https://github.com/sharonpeter669966-bit/INSTRUCTION-CYCLE-SIMULATORR.git
cd INSTRUCTION-CYCLE-SIMULATORR
```
Then open `index.html` in your browser (or use the **Live Server** extension in VS Code).

---

## 🎬 Try This Example

```asm
MOV R2, 7
MOV R3, 5
ADD R1, R2, R3   ; R1 = R2 + R3
HALT
```

Watching `ADD R1, R2, R3` step by step:

| Step | Action | Result |
|------|--------|--------|
| 1. Fetch | `IR ← Memory[PC]` | Instruction loaded |
| 2. Decode | Identify opcode and registers | R1, R2, R3 selected |
| 3. Execute | `ALU: R2 + R3` | 7 + 5 = 12 |
| 4. Memory Access | Not required for ADD | Pass-through |
| 5. Write Back | `R1 ← 12, PC ← PC + 1` | R1 updated |

Want a loop? Pick **"Countdown loop (JZ / JUMP)"** from the example dropdown.

---

## 🗂️ Project Structure

```
INSTRUCTION-CYCLE-SIMULATORR/
├── index.html   → page layout, panels and datapath diagram
├── style.css    → colourful poster-inspired design & glow animations
├── script.js    → assembler, CPU model and the 5-stage engine
└── README.md    → you are here 👋
```

---

## 🧠 How It Works Inside

1. **Assembler**: parses your text into instruction objects, resolves labels and reports errors by line number.
2. **CPU state**: PC, IR, four registers, three flags and a 16-cell data memory.
3. **Stage engine**: five functions (`stageFetch`, `stageDecode`, `stageExecute`, `stageMemory`, `stageWriteBack`) run in a fixed order, one per click or tick.
4. **Renderer**: after every stage the UI refreshes, highlights the active blocks and flashes whatever changed.

---

## 🎯 Why It's Useful

- Helps beginners understand **how a CPU really works**
- Bridges the gap between **theory and real execution**
- A **visual, interactive** learning experience
- Great for **college projects and presentations**
- Builds a foundation for advanced topics like **pipelining, caching and processor design**

---

## 🔮 Future Ideas

- [ ] Pipelined execution mode (overlapping stages)
- [ ] More instructions (MUL, DIV, shifts, CMP)
- [ ] Cache simulation
- [ ] Save / share programs through a link
- [ ] Dark mode

---

## 📚 Subject

**Computer Organisation and Architecture**

<div align="center">

<br>

### *Small Steps ➜ Big Understanding ➜ Better Future*

Made with ❤️ by [sharonpeter669966-bit](https://github.com/sharonpeter669966-bit)

⭐ If this helped you learn, give the repo a star!

</div>
