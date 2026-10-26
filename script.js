/* ==========================================================
   INSTRUCTION CYCLE SIMULATOR
   Five mandatory stages for EVERY instruction:
   1 Fetch -> 2 Decode -> 3 Execute -> 4 Memory Access -> 5 Write Back
   ========================================================== */

const $ = (id) => document.getElementById(id);

const STAGE_NAMES = ["Fetch", "Decode", "Execute", "Memory Access", "Write Back"];
const DATA_SIZE = 16;
const MAX_VAL = 255; // 8-bit registers

/* ---------- Example programs ---------- */
const EXAMPLES = {
  basic: `MOV R2, 7
MOV R3, 5
ADD R1, R2, R3   ; R1 = R2 + R3
HALT`,
  memory: `MOV R1, 25
STORE R1, [3]    ; Mem[3] = R1
MOV R1, 0
LOAD R2, [3]     ; R2 = Mem[3]
ADD R3, R2, R2
STORE R3, [4]
HALT`,
  logic: `MOV R0, 12
MOV R1, 10
AND R2, R0, R1   ; 12 AND 10 = 8
OR  R3, R0, R1   ; 12 OR 10 = 14
SUB R0, R1, R0   ; 10 - 12 -> borrow (Carry = 1)
HALT`,
  loop: `MOV R0, 3        ; counter
MOV R1, 0        ; sum
MOV R2, 1
loop:
ADD R1, R1, R0   ; sum += counter
SUB R0, R0, R2   ; counter--
JZ done          ; stop when counter == 0
JUMP loop
done:
STORE R1, [0]
HALT`,
};

/* ---------- Simulator state ---------- */
let S = null;        // CPU state
let program = [];    // assembled instructions
let timer = null;    // run timer
let changed = [];    // ids to flash after render

function freshState() {
  return {
    pc: 0,
    ir: "—",
    regs: [0, 0, 0, 0],
    flags: { Z: 0, C: 0, S: 0 },
    dmem: new Array(DATA_SIZE).fill(0),
    stage: 0,        // next stage to execute
    last: -1,        // last stage executed (for highlight)
    cur: null,       // current instruction being processed
    halted: false,
    stageCount: 0,
    instrCount: 0,
    memTouched: -1,
  };
}

/* ==========================================================
   ASSEMBLER
   ========================================================== */
const OPS = ["MOV", "ADD", "SUB", "AND", "OR", "LOAD", "STORE", "JUMP", "JZ", "HALT"];

function parseReg(tok) {
  const m = /^R([0-3])$/i.exec(tok || "");
  return m ? parseInt(m[1], 10) : null;
}
function parseImm(tok) {
  if (tok == null) return null;
  const m = /^#?(-?\d+|0x[0-9a-f]+)$/i.exec(tok);
  if (!m) return null;
  return parseInt(m[1], m[1].toLowerCase().startsWith("0x") ? 16 : 10) & MAX_VAL;
}
function parseMem(tok) {
  const m = /^\[\s*(\d+)\s*\]$/.exec(tok || "");
  if (!m) return null;
  const a = parseInt(m[1], 10);
  return a >= 0 && a < DATA_SIZE ? a : null;
}

function assemble(src) {
  const raw = [];
  const labels = {};
  src.split("\n").forEach((line, i) => {
    let l = line.split(";")[0].trim();
    if (!l) return;
    const lab = /^(\w+):\s*(.*)$/.exec(l);
    if (lab) {
      labels[lab[1].toUpperCase()] = raw.length;
      l = lab[2].trim();
      if (!l) return;
    }
    raw.push({ text: l, line: i + 1 });
  });

  if (raw.length === 0) throw new Error("Program is empty.");

  return raw.map((r) => {
    const sp = r.text.indexOf(" ");
    const op = (sp === -1 ? r.text : r.text.slice(0, sp)).toUpperCase();
    const args = sp === -1 ? [] : r.text.slice(sp + 1).split(",").map((a) => a.trim()).filter(Boolean);
    const ins = { text: r.text.replace(/\s+/g, " "), op, line: r.line };
    const err = (msg) => { throw new Error(`Line ${r.line}: ${msg}`); };

    if (!OPS.includes(op)) err(`unknown instruction "${op}".`);

    const need = (n) => { if (args.length !== n) err(`${op} needs ${n} operand(s).`); };

    switch (op) {
      case "MOV": {
        need(2);
        ins.rd = parseReg(args[0]);
        if (ins.rd === null) err("first operand must be a register (R0-R3).");
        const rs = parseReg(args[1]);
        if (rs !== null) ins.rs = rs;
        else {
          ins.imm = parseImm(args[1]);
          if (ins.imm === null) err("second operand must be a register or number.");
        }
        break;
      }
      case "ADD": case "SUB": case "AND": case "OR": {
        need(3);
        ins.rd = parseReg(args[0]); ins.rs = parseReg(args[1]); ins.rt = parseReg(args[2]);
        if (ins.rd === null || ins.rs === null || ins.rt === null) err("operands must be registers (R0-R3).");
        break;
      }
      case "LOAD": {
        need(2);
        ins.rd = parseReg(args[0]); ins.addr = parseMem(args[1]);
        if (ins.rd === null) err("first operand must be a register.");
        if (ins.addr === null) err(`second operand must look like [0]..[${DATA_SIZE - 1}].`);
        break;
      }
      case "STORE": {
        need(2);
        ins.rs = parseReg(args[0]); ins.addr = parseMem(args[1]);
        if (ins.rs === null) err("first operand must be a register.");
        if (ins.addr === null) err(`second operand must look like [0]..[${DATA_SIZE - 1}].`);
        break;
      }
      case "JUMP": case "JZ": {
        need(1);
        const t = args[0];
        if (/^\d+$/.test(t)) ins.target = parseInt(t, 10);
        else if (labels[t.toUpperCase()] !== undefined) ins.target = labels[t.toUpperCase()];
        else err(`unknown label "${t}".`);
        if (ins.target >= raw.length) err("jump target is outside the program.");
        ins.label = t;
        break;
      }
      case "HALT":
        need(0);
        break;
    }
    return ins;
  });
}

/* ==========================================================
   CONTROL UNIT: signals per opcode
   ========================================================== */
function controlSignals(op) {
  const regWrite = ["MOV", "ADD", "SUB", "AND", "OR", "LOAD"].includes(op);
  return {
    RegWrite: regWrite ? 1 : 0,
    MemRead: op === "LOAD" ? 1 : 0,
    MemWrite: op === "STORE" ? 1 : 0,
    Branch: op === "JUMP" || op === "JZ" ? 1 : 0,
    ALUOp: { MOV: "PASS", ADD: "ADD", SUB: "SUB", AND: "AND", OR: "OR",
             LOAD: "ADDR", STORE: "ADDR", JUMP: "TARGET", JZ: "TARGET", HALT: "NONE" }[op],
  };
}

/* ==========================================================
   LOG / HELPERS
   ========================================================== */
function log(text, cls = "sys") {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  const box = $("log");
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}
const hex = (v) => "0x" + v.toString(16).toUpperCase().padStart(2, "0");
const fmt = (v) => `${v} (${hex(v)})`;
const mark = (...ids) => changed.push(...ids);

/* ==========================================================
   THE FIVE STAGES
   ========================================================== */
function stageFetch() {
  if (S.pc < 0 || S.pc >= program.length) {
    S.halted = true;
    log(`PC=${S.pc} is outside program memory. CPU halted.`, "sys");
    return "PC ran past the end of the program. CPU halted (add a HALT instruction).";
  }
  S.cur = { ...program[S.pc], pcAtFetch: S.pc };
  S.ir = S.cur.text;
  mark("irVal");
  log(`[Fetch]  IR ← Memory[${S.pc}] = "${S.ir}"`, "t1");
  setTrace(0, `IR ← Memory[${S.pc}]`, `IR = ${S.ir}`);
  $("traceInstr").textContent = S.ir;
  return `<b>Fetch:</b> The CPU uses PC = ${S.pc} to read the instruction from program memory into the Instruction Register: <code>${S.ir}</code>.`;
}

function stageDecode() {
  const c = S.cur;
  c.sig = controlSignals(c.op);
  // read source operands from the register file
  if (c.op === "MOV" && c.rs !== undefined) c.a = S.regs[c.rs];
  if (["ADD", "SUB", "AND", "OR"].includes(c.op)) { c.a = S.regs[c.rs]; c.b = S.regs[c.rt]; }
  if (c.op === "STORE") c.a = S.regs[c.rs];
  if (c.op === "MOV" && c.imm !== undefined) c.a = c.imm;

  const ops = [];
  if (c.rd !== undefined) ops.push("R" + c.rd);
  if (c.rs !== undefined) ops.push("R" + c.rs);
  if (c.rt !== undefined) ops.push("R" + c.rt);
  if (c.imm !== undefined) ops.push("#" + c.imm);
  if (c.addr !== undefined) ops.push(`[${c.addr}]`);
  if (c.target !== undefined) ops.push("→ " + c.target);
  c.operandText = ops.join(", ") || "none";

  log(`[Decode] opcode=${c.op}, operands: ${c.operandText}`, "t2");
  setTrace(1, "Identify opcode and registers", `${c.op}: ${c.operandText}`);
  return `<b>Decode:</b> The Control Unit identifies opcode <code>${c.op}</code> with operands <code>${c.operandText}</code> and sets control signals (RegWrite=${c.sig.RegWrite}, MemRead=${c.sig.MemRead}, MemWrite=${c.sig.MemWrite}, Branch=${c.sig.Branch}).`;
}

function stageExecute() {
  const c = S.cur;
  let res = null, desc = "";
  const setZS = (v) => { S.flags.Z = v === 0 ? 1 : 0; S.flags.S = (v >> 7) & 1; mark("flagZ", "flagS"); };

  switch (c.op) {
    case "MOV":
      res = c.a & MAX_VAL; S.flags.C = 0; setZS(res); mark("flagC");
      desc = `ALU passes ${res}`;
      break;
    case "ADD": {
      const raw = c.a + c.b; res = raw & MAX_VAL;
      S.flags.C = raw > MAX_VAL ? 1 : 0; setZS(res); mark("flagC");
      desc = `${c.a} + ${c.b} = ${raw}${raw > MAX_VAL ? " → overflow, wraps to " + res : ""}`;
      break;
    }
    case "SUB": {
      const raw = c.a - c.b; res = raw & MAX_VAL;
      S.flags.C = raw < 0 ? 1 : 0; setZS(res); mark("flagC");
      desc = `${c.a} − ${c.b} = ${raw}${raw < 0 ? " → borrow, wraps to " + res : ""}`;
      break;
    }
    case "AND":
      res = c.a & c.b; S.flags.C = 0; setZS(res); mark("flagC");
      desc = `${c.a} AND ${c.b} = ${res}`;
      break;
    case "OR":
      res = c.a | c.b; S.flags.C = 0; setZS(res); mark("flagC");
      desc = `${c.a} OR ${c.b} = ${res}`;
      break;
    case "LOAD": case "STORE":
      res = c.addr; desc = `effective address = ${c.addr}`;
      break;
    case "JUMP":
      res = c.target; c.taken = true; desc = `branch target = ${c.target}`;
      break;
    case "JZ":
      res = c.target; c.taken = S.flags.Z === 1;
      desc = `Z = ${S.flags.Z} → branch ${c.taken ? "TAKEN to " + c.target : "NOT taken"}`;
      break;
    case "HALT":
      desc = "no ALU work";
      break;
  }
  c.result = res;
  c.aluDesc = desc;
  mark("flagZ", "flagC", "flagS");
  log(`[Execute] ALU(${c.sig.ALUOp}): ${desc}`, "t3");
  setTrace(2, `ALU: ${c.sig.ALUOp}`, desc);
  return `<b>Execute:</b> The ALU performs <code>${c.sig.ALUOp}</code> — ${desc}. Status flags updated: Z=${S.flags.Z}, C=${S.flags.C}, S=${S.flags.S}.`;
}

function stageMemory() {
  const c = S.cur;
  let msg, short;
  S.memTouched = -1;
  if (c.op === "LOAD") {
    c.memData = S.dmem[c.addr];
    S.memTouched = c.addr;
    c.memDesc = `read Mem[${c.addr}] = ${c.memData}`;
    msg = `<b>Memory Access:</b> LOAD reads data memory cell ${c.addr} and gets <code>${c.memData}</code>.`;
    mark("mem" + c.addr);
  } else if (c.op === "STORE") {
    S.dmem[c.addr] = c.a;
    S.memTouched = c.addr;
    c.memDesc = `write Mem[${c.addr}] ← ${c.a}`;
    msg = `<b>Memory Access:</b> STORE writes <code>${c.a}</code> into data memory cell ${c.addr}.`;
    mark("mem" + c.addr);
  } else {
    c.memDesc = "no data-memory operation (stage still passes through)";
    msg = `<b>Memory Access:</b> <code>${c.op}</code> does not touch data memory, so this stage simply passes the result along.`;
  }
  short = c.memDesc;
  log(`[Memory] ${short}`, "t4");
  setTrace(3, c.op === "LOAD" || c.op === "STORE" ? "Data memory access" : "Pass-through (no memory op)", short);
  return msg;
}

function stageWriteBack() {
  const c = S.cur;
  let next = S.pc + 1;
  const notes = [];

  if (c.sig.RegWrite) {
    const val = c.op === "LOAD" ? c.memData : c.result;
    S.regs[c.rd] = val & MAX_VAL;
    mark("reg" + c.rd);
    notes.push(`R${c.rd} ← ${val}`);
  } else {
    notes.push("no register written");
  }

  if (c.op === "JUMP" || (c.op === "JZ" && c.taken)) {
    next = c.target;
    notes.push(`PC ← ${next}`);
  } else if (c.op === "HALT") {
    S.halted = true;
    next = S.pc;
    notes.push("CPU halted");
  } else {
    notes.push(`PC ← PC + 1 = ${next}`);
  }

  S.pc = next;
  mark("pcVal");
  S.instrCount++;
  const text = notes.join(", ");
  log(`[WriteBack] ${text}`, "t5");
  setTrace(4, "Rd ← result, update PC", text);
  return `<b>Write Back:</b> ${text}. Instruction complete!`;
}

const STAGE_FUNCS = [stageFetch, stageDecode, stageExecute, stageMemory, stageWriteBack];

/* ==========================================================
   STEP LOGIC
   ========================================================== */
function stepStage() {
  if (!S || S.halted) return false;
  changed = [];
  const idx = S.stage;
  const msg = STAGE_FUNCS[idx]();
  S.last = idx;
  S.stageCount++;
  if (S.halted && idx === 0) {
    // fetch failed
  } else {
    S.stage = (idx + 1) % 5;
  }
  $("explain").innerHTML = msg;
  render();
  if (S.halted) finishRun();
  return !S.halted;
}

function stepInstruction() {
  if (!S || S.halted) return;
  // finish the remaining stages of the current instruction (or a full one)
  do {
    stepStage();
  } while (!S.halted && S.stage !== 0);
}

function run() {
  if (!S || S.halted) return;
  $("btnRun").disabled = true;
  $("btnPause").disabled = false;
  $("btnStage").disabled = true;
  $("btnInstr").disabled = true;
  const tick = () => {
    if (!stepStage()) return;
    timer = setTimeout(tick, parseInt($("speed").value, 10));
  };
  tick();
}

function pause() {
  clearTimeout(timer);
  timer = null;
  $("btnRun").disabled = !!(S && S.halted);
  $("btnPause").disabled = true;
  $("btnStage").disabled = !!(S && S.halted);
  $("btnInstr").disabled = !!(S && S.halted);
}

function finishRun() {
  clearTimeout(timer);
  timer = null;
  $("btnRun").disabled = true;
  $("btnPause").disabled = true;
  $("btnStage").disabled = true;
  $("btnInstr").disabled = true;
  log("CPU halted. Press Reset to run again.", "sys");
}

/* ==========================================================
   LOAD / RESET
   ========================================================== */
function loadProgram() {
  clearTimeout(timer);
  timer = null;
  const status = $("asmStatus");
  try {
    program = assemble($("program").value);
  } catch (e) {
    status.textContent = "⚠ " + e.message;
    status.className = "status err";
    return;
  }
  status.textContent = `✔ Program loaded: ${program.length} instruction(s).`;
  status.className = "status ok";
  resetCPU();
  log(`Program loaded (${program.length} instructions).`, "sys");
}

function resetCPU() {
  clearTimeout(timer);
  timer = null;
  S = freshState();
  changed = [];
  $("btnRun").disabled = false;
  $("btnPause").disabled = true;
  $("btnStage").disabled = false;
  $("btnInstr").disabled = false;
  $("explain").innerHTML = "CPU reset. Press <b>Step Stage</b> to begin the instruction cycle.";
  $("traceInstr").textContent = program[0] ? program[0].text : "—";
  resetTrace();
  $("log").innerHTML = "";
  log("CPU reset. PC = 0.", "sys");
  render();
}

/* ==========================================================
   RENDER
   ========================================================== */
const TRACE_DEFAULT = [
  ["1. Fetch", "IR ← Memory[PC]"],
  ["2. Decode", "Identify opcode and registers"],
  ["3. Execute", "ALU operation"],
  ["4. Memory Access", "Read / write data memory"],
  ["5. Write Back", "Rd ← result, PC ← next"],
];

function resetTrace() {
  $("traceBody").innerHTML = TRACE_DEFAULT
    .map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>—</td></tr>`).join("");
}
function setTrace(i, action, result) {
  const rows = $("traceBody").children;
  if (i === 0) resetTrace();
  const row = $("traceBody").children[i];
  row.children[1].textContent = action;
  row.children[2].textContent = result;
  [...$("traceBody").children].forEach((r, k) => r.classList.toggle("hl", k === i));
  void rows;
}

function setGlow(ids, on) {
  ids.forEach((id) => { const e = $(id); if (e) e.classList.toggle("glow", on); });
}

function render() {
  /* stage chips */
  document.querySelectorAll(".stage").forEach((el) => {
    const i = parseInt(el.dataset.stage, 10);
    el.classList.toggle("active", i === S.last && !(S.halted && S.last === 4 && false));
    el.classList.toggle("done", S.last >= 0 && i < S.last);
  });
  $("nextStage").textContent = S.halted ? "— (halted)" : STAGE_NAMES[S.stage];

  /* datapath glow per stage */
  setGlow(["b-pm", "b-ir", "b-cu", "b-alu", "b-regs", "b-pc", "b-dm", "l-pm", "l-ir", "l-dm"], false);
  const glowMap = [
    ["b-pm", "b-ir", "b-pc", "l-pm"],
    ["b-ir", "b-cu", "b-regs", "l-ir"],
    ["b-cu", "b-alu", "b-regs"],
    ["b-alu", "b-dm", "l-dm"],
    ["b-regs", "b-pc"],
  ];
  if (S.last >= 0) setGlow(glowMap[S.last], true);

  /* registers */
  const grid = $("regGrid");
  grid.innerHTML = S.regs.map((v, i) =>
    `<div class="reg" id="reg${i}"><b>R${i}</b><div class="dec">${v}</div><div class="hex">${hex(v)} · ${v.toString(2).padStart(8, "0")}</div></div>`
  ).join("");
  $("regMini").textContent = S.regs.map((v, i) => `R${i}=${v}`).join("  ");

  /* flags */
  ["Z", "C", "S"].forEach((f) => {
    const el = $("flag" + f);
    el.querySelector("b").textContent = S.flags[f];
    el.classList.toggle("on", S.flags[f] === 1);
  });

  /* PC / IR */
  $("pcVal").textContent = S.pc;
  $("irVal").textContent = S.ir;

  /* program memory list */
  $("progMem").innerHTML = program.map((p, i) => {
    const isPc = i === S.pc && !S.halted;
    const fetched = S.cur && S.cur.pcAtFetch === i && S.last >= 0 && S.last < 4;
    return `<div class="mem-row ${isPc ? "pc" : ""} ${fetched ? "fetched" : ""}"><span class="addr">${i}</span><span>${p.text}</span>${isPc ? "<span style='margin-left:auto'>◀ PC</span>" : ""}</div>`;
  }).join("");
  $("pmMini").textContent = program[S.pc] ? `[${S.pc}] ${program[S.pc].text}` : "—";

  /* data memory */
  $("dataMem").innerHTML = S.dmem.map((v, i) =>
    `<div class="cell ${i === S.memTouched && S.last === 3 ? "glow" : ""}" id="mem${i}"><small>[${i}]</small><b>${v}</b></div>`
  ).join("");
  $("dmMini").textContent = S.memTouched >= 0 ? `[${S.memTouched}] = ${S.dmem[S.memTouched]}` : "cells 0–15";

  /* current instruction table */
  const c = S.cur;
  $("ciText").textContent = c ? c.text : "—";
  $("ciOp").textContent = c ? c.op : "—";
  $("ciOperands").textContent = c && c.operandText ? c.operandText : "—";
  $("ciSignals").textContent = c && c.sig
    ? `RegWrite=${c.sig.RegWrite} MemRead=${c.sig.MemRead} MemWrite=${c.sig.MemWrite} Branch=${c.sig.Branch}` : "—";
  $("ciAlu").textContent = c && c.aluDesc ? `${c.sig.ALUOp}: ${c.aluDesc}` : "—";
  $("ciResult").textContent = c && c.result != null && S.last >= 2 ? fmt(c.result) : "—";
  $("ciMem").textContent = c && c.memDesc && S.last >= 3 ? c.memDesc : "—";
  $("cuMini").textContent = c && c.sig ? `${c.op} · ALU=${c.sig.ALUOp}` : "idle";
  $("aluMini").textContent = c && c.aluDesc && S.last >= 2 ? c.aluDesc : "idle";

  /* stats */
  $("statCycles").textContent = S.stageCount;
  $("statInstr").textContent = S.instrCount;
  $("statState").textContent = S.halted ? "Halted" : S.last < 0 ? "Ready" : "Running: " + STAGE_NAMES[S.last];

  /* flash changed elements */
  changed.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  });
}

/* ==========================================================
   EVENTS
   ========================================================== */
$("btnLoad").addEventListener("click", loadProgram);
$("btnStage").addEventListener("click", stepStage);
$("btnInstr").addEventListener("click", stepInstruction);
$("btnRun").addEventListener("click", run);
$("btnPause").addEventListener("click", pause);
$("btnReset").addEventListener("click", () => {
  if (program.length) resetCPU(); else loadProgram();
});
$("btnClearLog").addEventListener("click", () => ($("log").innerHTML = ""));
$("speed").addEventListener("input", () => ($("speedVal").textContent = $("speed").value + " ms"));
$("examples").addEventListener("change", () => {
  $("program").value = EXAMPLES[$("examples").value];
  loadProgram();
});

/* ---------- Boot ---------- */
$("program").value = EXAMPLES.basic;
loadProgram();