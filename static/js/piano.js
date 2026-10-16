"use strict";

(function () {
  /* ============================================================
   * Constantes musicales
   * ============================================================ */

  var PITCH_BY_SEMITONE = [
    ["C", "Do"], ["C#", "Do#"], ["D", "Ré"], ["D#", "Ré#"],
    ["E", "Mi"], ["F", "Fa"], ["F#", "Fa#"], ["G", "Sol"],
    ["G#", "Sol#"], ["A", "La"], ["A#", "La#"], ["B", "Si"]
  ];
  var DIATONIC_BY_LETTER = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  var SHARP_PCS = { 1: true, 3: true, 6: true, 8: true, 10: true };

  var MIN_OCTAVE = 2;
  var MAX_OCTAVE = 6;
  var DEFAULT_OCTAVE = 4;

  var MAX_STAFF_NOTES = 16;
  var CHORD_TIMING_MS = 60;

  var SVG_NS = "http://www.w3.org/2000/svg";

  /* ============================================================
   * État global
   * ============================================================ */

  var app = {
    ctx: null,
    masterGain: null,
    compressor: null,
    volume: 0.8,
    timbre: "piano-doux",
    baseOctave: DEFAULT_OCTAVE,
    showNames: true,
    activeVoices: {},   /* midi -> voice */
    pressedKeys: {},    /* code clavier -> midi */
    pointerKeys: {},    /* pointerId -> midi */
    staffEvents: [],    /* {midi, ts, dur} */
    lastNote: null,
    state: "ready",     /* ready | recording | playing */
    recording: { events: [], startTime: 0 },
    playbackTimers: []
  };

  var dom = {};

  function initDom() {
    dom.audioStatus = document.getElementById("audioStatus");
    dom.audioStatusText = dom.audioStatus.querySelector(".status-text");
    dom.lastNoteName = document.getElementById("lastNoteName");
    dom.lastNoteDetails = document.getElementById("lastNoteDetails");
    dom.noteFacts = document.getElementById("noteFacts");
    dom.chordBox = document.getElementById("chordBox");
    dom.activeNotes = document.getElementById("activeNotes");
    dom.staffNotes = document.getElementById("staffNotes");
    dom.staffLines = document.getElementById("staffLines");
    dom.staffClef = document.getElementById("clefG");
    dom.piano = document.getElementById("piano");
    dom.timbreSelect = document.getElementById("timbreSelect");
    dom.volumeRange = document.getElementById("volumeRange");
    dom.volumeValue = document.getElementById("volumeValue");
    dom.octaveDown = document.getElementById("octaveDown");
    dom.octaveUp = document.getElementById("octaveUp");
    dom.octaveValue = document.getElementById("octaveValue");
    dom.showNames = document.getElementById("showNames");
    dom.panicBtn = document.getElementById("panicBtn");
    dom.recordStatus = document.getElementById("recordStatus");
    dom.recordInfo = document.getElementById("recordInfo");
    dom.recordStart = document.getElementById("recordStart");
    dom.recordStop = document.getElementById("recordStop");
    dom.playBtn = document.getElementById("playBtn");
    dom.stopPlayBtn = document.getElementById("stopPlayBtn");
    dom.clearBtn = document.getElementById("clearBtn");
    dom.helpToggle = document.getElementById("helpToggle");
    dom.helpSection = document.getElementById("helpSection");
  }

  /* ============================================================
   * Helpers musique
   * ============================================================ */

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function noteNames(midi) {
    var pc = midi % 12;
    return {
      en: PITCH_BY_SEMITONE[pc][0],
      fr: PITCH_BY_SEMITONE[pc][1],
      octave: Math.floor(midi / 12) - 1,
      pc: pc,
      sharp: !!SHARP_PCS[pc]
    };
  }

  function midiToDiatonic(midi) {
    var n = noteNames(midi);
    return n.octave * 7 + DIATONIC_BY_LETTER[n.en.charAt(0)];
  }

  /* ============================================================
   * Web Audio : initialisation
   * ============================================================ */

  function ensureAudio() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      setAudioStatus("error", "Erreur audio : Web Audio n'est pas disponible.");
      return null;
    }
    if (!app.ctx) {
      try {
        app.ctx = new Ctor();
      } catch (err) {
        setAudioStatus("error", "Erreur audio : impossible de créer l'audio.");
        return null;
      }
      app.compressor = app.ctx.createDynamicsCompressor();
      app.compressor.threshold.value = -18;
      app.compressor.knee.value = 24;
      app.compressor.ratio.value = 8;
      app.compressor.attack.value = 0.004;
      app.compressor.release.value = 0.18;
      app.compressor.connect(app.ctx.destination);

      app.masterGain = app.ctx.createGain();
      app.masterGain.gain.value = app.volume * app.volume;
      app.masterGain.connect(app.compressor);
    }
    if (app.ctx.state === "suspended") {
      app.ctx.resume().catch(function () { /* ignore */ });
    }
    setAudioStatus("ready", "Audio : prêt");
    return app.ctx;
  }

  function setAudioStatus(state, text) {
    if (!dom.audioStatus) return;
    dom.audioStatus.setAttribute("data-state", state);
    dom.audioStatusText.textContent = text;
  }

  function setVolume(val) {
    app.volume = Math.min(1, Math.max(0, val));
    if (app.masterGain && app.ctx) {
      app.masterGain.gain.setTargetAtTime(app.volume * app.volume, app.ctx.currentTime, 0.02);
    }
    if (dom.volumeValue) {
      dom.volumeValue.textContent = Math.round(app.volume * 100);
    }
  }

  /* ============================================================
   * Web Audio : synthèse par timbre
   * ============================================================ */

  function makeOsc(type, freq, gainValue) {
    var osc = app.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    var gain = app.ctx.createGain();
    gain.gain.value = gainValue;
    return { osc: osc, gain: gain };
  }

  function envParamsFor(t) {
    if (t === "synthe") {
      return { attack: 0.02, decay: 0.6, sustain: 0.72, release: 0.5, peak: 0.9 };
    }
    if (t === "piano-brillant") {
      return { attack: 0.004, decay: 0.7, sustain: 0.14, release: 0.28, peak: 1 };
    }
    return { attack: 0.007, decay: 0.55, sustain: 0.2, release: 0.25, peak: 0.9 };
  }

  function buildVoice(freq) {
    var t = app.timbre;
    var oscs = [];
    var filt = app.ctx.createBiquadFilter();
    var env = app.ctx.createGain();
    var now = app.ctx.currentTime;

    filt.type = "lowpass";
    env.gain.value = 0;

    if (t === "piano-brillant") {
      filt.frequency.value = 6500;
      filt.Q.value = 0.4;
      oscs.push(makeOsc("sawtooth", freq, 0.62));
      oscs.push(makeOsc("triangle", freq * 2, 0.28));
      oscs.push(makeOsc("sine", freq * 3, 0.14));
    } else if (t === "synthe") {
      filt.frequency.setValueAtTime(700, now);
      filt.frequency.exponentialRampToValueAtTime(3200, now + 0.12);
      filt.Q.value = 6;
      oscs.push(makeOsc("sawtooth", freq, 0.55));
      oscs.push(makeOsc("sawtooth", freq * 1.007, 0.4));
      oscs.push(makeOsc("square", freq * 0.5, 0.22));
    } else {
      filt.frequency.value = 2400;
      filt.Q.value = 0.3;
      oscs.push(makeOsc("sine", freq, 0.85));
      oscs.push(makeOsc("triangle", freq * 2, 0.18));
      oscs.push(makeOsc("sine", freq * 2.99, 0.08));
    }

    for (var i = 0; i < oscs.length; i++) {
      oscs[i].osc.connect(oscs[i].gain);
      oscs[i].gain.connect(filt);
    }
    filt.connect(env);
    env.connect(app.masterGain);

    return {
      oscs: oscs,
      filter: filt,
      env: env,
      envParams: envParamsFor(t)
    };
  }

  function voiceStart(voice, velocity) {
    var p = voice.envParams;
    var t0 = app.ctx.currentTime;
    var peak = Math.max(p.peak * velocity, 0.0002);
    voice.env.gain.setValueAtTime(0.0001, t0);
    voice.env.gain.exponentialRampToValueAtTime(peak, t0 + p.attack);
    voice.env.gain.exponentialRampToValueAtTime(
      Math.max(peak * p.sustain, 0.0002),
      t0 + p.attack + p.decay
    );
  }

  function voiceRelease(voice, immediate) {
    var p = voice.envParams;
    var now = app.ctx.currentTime;
    var current = voice.env.gain.value;
    try {
      voice.env.gain.cancelScheduledValues(now);
      voice.env.gain.setValueAtTime(Math.max(current, 0.0001), now);
      voice.env.gain.exponentialRampToValueAtTime(0.0001, now + (immediate ? 0.02 : p.release));
    } catch (err) { /* ignore */ }
    var end = now + (immediate ? 0.05 : p.release + 0.06);
    for (var i = 0; i < voice.oscs.length; i++) {
      try {
        voice.oscs[i].osc.stop(end);
      } catch (err) { /* déjà arrêté */ }
    }
    var delayMs = Math.max(0, (end - now)) * 1000 + 200;
    window.setTimeout(function () {
      try {
        for (var j = 0; j < voice.oscs.length; j++) {
          voice.oscs[j].osc.disconnect();
          voice.oscs[j].gain.disconnect();
        }
        voice.filter.disconnect();
        voice.env.disconnect();
      } catch (err) { /* ignore */ }
    }, delayMs);
  }

  /* ============================================================
   * Moteur de notes
   * ============================================================ */

  function noteOn(midi, velocity) {
    if (typeof velocity !== "number" || !isFinite(velocity) || velocity <= 0) {
      velocity = 1;
    }
    var ctx = ensureAudio();
    if (!ctx) return;
    if (app.activeVoices[midi] !== undefined) {
      return;
    }

    var freq = midiToFreq(midi);
    var voice = null;
    try {
      voice = buildVoice(freq);
      for (var i = 0; i < voice.oscs.length; i++) {
        voice.oscs[i].osc.start();
      }
      voiceStart(voice, velocity);
    } catch (err) {
      if (voice) {
        try {
          for (var k = 0; k < voice.oscs.length; k++) {
            voice.oscs[k].osc.disconnect();
            voice.oscs[k].gain.disconnect();
          }
          voice.filter.disconnect();
          voice.env.disconnect();
        } catch (e2) { /* ignore */ }
      }
      setAudioStatus("error", "Erreur audio lors de la lecture.");
      return;
    }

    voice.midi = midi;
    voice.startedAt = performance.now();
    voice.finishTimer = window.setTimeout(function () {
      stopVoice(midi, true);
    }, 9000);

    app.activeVoices[midi] = voice;

    if (activeVoicesCount() > 32) {
      var oldest = oldestVoice();
      if (oldest && oldest.midi !== midi) {
        stopVoice(oldest.midi, true);
      }
    }

    if (app.state === "recording") {
      recordEvent(midi, velocity, null);
    }

    app.lastNote = midi;
    addStaffEvent(midi);
    updateNoteUI(midi, true);
  }

  function noteOff(midi) {
    if (midi === undefined) return;
    if (app.activeVoices[midi] === undefined) return;

    stopVoice(midi, false);

    if (app.state === "recording") {
      closeRecordingEvent(midi);
    }
    updateNoteUI(midi, false);
  }

  function stopVoice(midi, immediate) {
    var voice = app.activeVoices[midi];
    if (!voice) return;
    clearTimeout(voice.finishTimer);
    voiceRelease(voice, immediate);
    delete app.activeVoices[midi];
  }

  function activeVoicesCount() {
    var n = 0;
    for (var k in app.activeVoices) {
      if (Object.prototype.hasOwnProperty.call(app.activeVoices, k)) n++;
    }
    return n;
  }

  function oldestVoice() {
    var oldest = null;
    for (var k in app.activeVoices) {
      if (!Object.prototype.hasOwnProperty.call(app.activeVoices, k)) continue;
      var v = app.activeVoices[k];
      if (!oldest || v.startedAt < oldest.startedAt) oldest = v;
    }
    return oldest;
  }

  function panic() {
    for (var k in app.activeVoices) {
      if (Object.prototype.hasOwnProperty.call(app.activeVoices, k)) {
        stopVoice(Number(k), true);
      }
    }
    updateNoteUI(undefined, false);
    refreshStaff();
  }

  function playKey(midi, velocity) {
    pressVisual(midi, true);
    noteOn(midi, velocity);
  }

  function releaseKey(midi) {
    pressVisual(midi, false);
    noteOff(midi);
  }

  /* ============================================================
   * Clavier du piano (interface)
   * ============================================================ */

  var isBlackPc = [false, true, false, true, false, false, true, false, true, false, true, false];

  function buildPiano() {
    var startMidi = 12 * (app.baseOctave + 1);
    var whiteCount = 0;
    var notes = [];
    for (var i = 0; i < 24; i++) {
      notes.push(startMidi + i);
      if (!isBlackPc[(startMidi + i) % 12]) whiteCount++;
    }

    dom.piano.innerHTML = "";
    var whiteW = 100 / whiteCount;

    var whiteBuffer = 0;
    for (var j = 0; j < notes.length; j++) {
      var m = notes[j];
      var p = noteNames(m);
      var black = isBlackPc[p.pc];
      var el = document.createElement("button");
      el.type = "button";
      el.className = "piano-key " + (black ? "bkey" : "wkey");
      el.setAttribute("data-midi", String(m));
      el.setAttribute("aria-label", "Jouer " + p.fr + " " + p.octave + ", " + p.en + p.octave);
      if (!black) {
        whiteBuffer++;
      } else {
        var blackW = 0.62 * whiteW;
        var left = whiteBuffer * whiteW - blackW / 2;
        el.style.left = left + "%";
        el.style.width = blackW + "%";
      }

      var label = document.createElement("span");
      label.className = "key-label";
      var nameLine = document.createElement("span");
      nameLine.className = "key-en";
      nameLine.textContent = p.en;
      var frLine = document.createElement("span");
      frLine.className = "key-fr";
      frLine.textContent = p.fr;
      label.appendChild(nameLine);
      label.appendChild(frLine);
      el.appendChild(label);

      if (!app.showNames) {
        el.classList.add("hide-label");
      }

      attachKeyListeners(el, m);
      dom.piano.appendChild(el);
    }
  }

  function attachKeyListeners(el, midi) {
    var triggerMidi = midi;

    el.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      try {
        el.setPointerCapture(ev.pointerId);
      } catch (err) { /* ignore */ }
      app.pointerKeys[ev.pointerId] = triggerMidi;
      playKey(triggerMidi, pointerVelocity(ev));
    });

    function endPointer(ev) {
      if (app.pointerKeys[ev.pointerId] !== undefined) {
        delete app.pointerKeys[ev.pointerId];
        releaseKey(triggerMidi);
      }
    }

    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointercancel", endPointer);
    el.addEventListener("lostpointercapture", endPointer);

    el.addEventListener("keydown", function (ev) {
      if (ev.code === "Space" || ev.code === "Enter") {
        ev.preventDefault();
        playKey(triggerMidi, 1);
      }
    });
    el.addEventListener("keyup", function (ev) {
      if (ev.code === "Space" || ev.code === "Enter") {
        ev.preventDefault();
        releaseKey(triggerMidi);
      }
    });
  }

  function pointerVelocity(ev) {
    if (ev.pressure && ev.pressure > 0) {
      return Math.min(1.2, 0.4 + ev.pressure * 0.9);
    }
    return 1;
  }

  function pressVisual(midi, pressed) {
    var el = dom.piano.querySelector('[data-midi="' + midi + '"]');
    if (!el) return;
    el.classList.toggle("pressed", pressed);
    if (pressed) {
      el.setAttribute("aria-pressed", "true");
    } else {
      el.removeAttribute("aria-pressed");
    }
  }

  /* ============================================================
   * Mapping du clavier de l'ordinateur (AZERTY / QWERTY)
   * ============================================================ */

  var TOP_ROW_CODES = [
    "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT",
    "KeyY", "KeyU", "KeyI", "KeyO", "KeyP",
    "BracketLeft", "BracketRight"
  ];
  var HOME_ROW_CODES = [
    "KeyA", "KeyS", "KeyD", "KeyF", "KeyG",
    "KeyH", "KeyJ", "KeyK", "KeyL",
    "Semicolon", "Quote", "Backslash"
  ];

  function codeToMidi(code) {
    var startMidi = 12 * (app.baseOctave + 1);
    var idx;
    if ((idx = TOP_ROW_CODES.indexOf(code)) !== -1) {
      return startMidi + idx;
    }
    if ((idx = HOME_ROW_CODES.indexOf(code)) !== -1) {
      return startMidi + 12 + idx;
    }
    return null;
  }

  function onKeyDown(ev) {
    if (ev.repeat) {
      ev.preventDefault();
      return;
    }
    var tag = ev.target && ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      return;
    }

    if (ev.code === "Escape") {
      ev.preventDefault();
      panic();
      cancelPlayback();
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      return;
    }
    if (ev.code === "Equal" || ev.code === "NumpadAdd") {
      ev.preventDefault();
      changeOctave(1);
      return;
    }
    if (ev.code === "Minus" || ev.code === "NumpadSubtract") {
      ev.preventDefault();
      changeOctave(-1);
      return;
    }
    if (ev.code === "KeyV" && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      ev.preventDefault();
      setShowNames(!app.showNames);
      return;
    }

    var midi = codeToMidi(ev.code);
    if (midi === null) return;

    if (app.pressedKeys[ev.code] !== undefined) {
      ev.preventDefault();
      return;
    }

    ev.preventDefault();
    app.pressedKeys[ev.code] = midi;
    playKey(midi, 1);
  }

  function onKeyUp(ev) {
    var midi = app.pressedKeys[ev.code];
    if (midi !== undefined) {
      delete app.pressedKeys[ev.code];
      releaseKey(midi);
    }
  }

  /* ============================================================
   * Octave
   * ============================================================ */

  function changeOctave(delta) {
    var next = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, app.baseOctave + delta));
    if (next === app.baseOctave) return;
    panic();
    app.baseOctave = next;
    dom.octaveValue.textContent = app.baseOctave + "–" + (app.baseOctave + 1);
    buildPiano();
    buildStaffBackground();
    dom.octaveDown.disabled = app.baseOctave <= MIN_OCTAVE;
    dom.octaveUp.disabled = app.baseOctave >= MAX_OCTAVE;
  }

  /* ============================================================
   * Interface : note jouée, accord, notes actives
   * ============================================================ */

  function updateNoteUI(midi, started) {
    if (started && midi !== undefined) {
      app.lastNote = midi;
    }
    var list = activeMidis();
    if (list.length === 0) {
      dom.activeNotes.textContent = "Aucune note maintenue.";
      dom.chordBox.textContent = "";
    } else {
      clearElement(dom.activeNotes);
      var label = document.createElement("span");
      label.className = "active-label";
      var names = list.map(function (m) {
        var n = noteNames(m);
        return n.fr + " " + n.octave;
      });
      label.textContent = "Notes maintenues : " + names.join(" · ");
      dom.activeNotes.appendChild(label);
      dom.chordBox.textContent = detectChord(list);
    }

    refreshLastNote();
  }

  function activeMidis() {
    return Object.keys(app.activeVoices).map(Number).sort(function (a, b) {
      return a - b;
    });
  }

  function refreshLastNote() {
    if (app.lastNote === null) {
      dom.lastNoteName.textContent = "—";
      dom.lastNoteName.setAttribute("data-empty", "true");
      dom.lastNoteDetails.textContent = "";
      clearElement(dom.noteFacts);
      return;
    }
    var n = noteNames(app.lastNote);
    var freq = midiToFreq(app.lastNote);
    dom.lastNoteName.textContent = n.fr + " " + n.octave;
    dom.lastNoteName.removeAttribute("data-empty");
    dom.lastNoteDetails.textContent =
      "Note " + n.en + n.octave + " — " + n.fr + " " + n.octave +
      " — " + Math.round(freq * 100) / 100 + " Hz";

    clearElement(dom.noteFacts);
    appendFact(n.fr + " " + n.octave);
    appendFact(n.en + n.octave);
    appendFact("Octave " + n.octave);
    appendFact(Math.round(freq * 100) / 100 + " Hz");
  }

  function appendFact(text) {
    var s = document.createElement("span");
    s.textContent = text;
    dom.noteFacts.appendChild(s);
  }

  function clearElement(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  /* ---------- Détection d'accord ---------- */

  var TRIADS = {
    "majeur": [0, 4, 7],
    "mineur": [0, 3, 7],
    "diminué": [0, 3, 6],
    "augmenté": [0, 4, 8],
    "suspendu 2 (sus2)": [0, 2, 7],
    "suspendu 4 (sus4)": [0, 5, 7],
    "diminué 7": [0, 3, 6, 9],
    "mineur 7": [0, 3, 7, 10],
    "septième de dominante": [0, 4, 7, 10],
    "majeur 7": [0, 4, 7, 11]
  };

  var INTERVALS = [
    [0, "unisson"], [1, "seconde mineure"], [2, "seconde majeure"],
    [3, "tierce mineure"], [4, "tierce majeure"], [5, "quarte juste"],
    [6, "quarte augmentée"], [7, "quinte juste"], [8, "quinte diminuée"],
    [9, "sixte majeure"], [10, "septième mineure"], [11, "septième majeure"]
  ];

  function detectChord(midis) {
    var added = {};
    var unique = [];
    midis.forEach(function (m) {
      var pc = m % 12;
      if (!added[pc]) {
        added[pc] = true;
        unique.push(pc);
      }
    });
    unique.sort(function (a, b) { return a - b; });
    if (unique.length === 0) return "";

    var root = unique[0];
    var intervals = unique.map(function (pc) {
      return (pc - root + 12) % 12;
    });
    intervals.sort(function (a, b) { return a - b; });

    for (var name in TRIADS) {
      if (!Object.prototype.hasOwnProperty.call(TRIADS, name)) continue;
      if (sameSet(intervals, TRIADS[name])) {
        var rootNote = noteNames(midis[0]);
        if (rootNote.pc !== root) {
          for (var i = 0; i < midis.length; i++) {
            if (midis[i] % 12 === root) {
              rootNote = noteNames(midis[i]);
              break;
            }
          }
        }
        return "Accord " + rootNote.fr + " " + rootNote.octave + " (" + name + ")";
      }
    }

    if (unique.length === 2) {
      var iv = (unique[1] - unique[0] + 12) % 12;
      for (var j = 0; j < INTERVALS.length; j++) {
        if (INTERVALS[j][0] === iv) {
          return "Intervalle : " + INTERVALS[j][1];
        }
      }
    }

    return "Accord non reconnu — notes : " +
      midis.map(function (m) { return noteNames(m).en + noteNames(m).octave; }).join(", ");
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var ca = a.slice().sort(function (x, y) { return x - y; });
    var cb = b.slice().sort(function (x, y) { return x - y; });
    for (var i = 0; i < ca.length; i++) {
      if (ca[i] !== cb[i]) return false;
    }
    return true;
  }

  /* ============================================================
   * Portée musicale (SVG)
   * ============================================================ */

  function buildStaffBackground() {
    clearElement(dom.staffLines);
    clearElement(dom.staffClef);

    var g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("stroke", "#a09178");
    for (var i = 0; i < 5; i++) {
      var line = document.createElementNS(SVG_NS, "line");
      var y = staffY(30 + i * 2);
      line.setAttribute("x1", "40");
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", "980");
      line.setAttribute("y2", String(y));
      line.setAttribute("class", "staff-line");
      g.appendChild(line);
    }
    var bar = document.createElementNS(SVG_NS, "line");
    bar.setAttribute("x1", "44");
    bar.setAttribute("y1", String(staffY(30)));
    bar.setAttribute("x2", "44");
    bar.setAttribute("y2", String(staffY(38)));
    bar.setAttribute("stroke", "#a09178");
    bar.setAttribute("stroke-width", "3");
    g.appendChild(bar);
    dom.staffLines.appendChild(g);

    var clef = document.createElementNS(SVG_NS, "text");
    clef.setAttribute("x", "56");
    clef.setAttribute("y", String(staffY(32) + 10));
    clef.setAttribute("font-size", "150");
    clef.setAttribute("font-family", "DejaVu Sans, Segoe UI Symbol, sans-serif");
    clef.setAttribute("fill", "#d9cbae");
    clef.setAttribute("dominant-baseline", "central");
    clef.textContent = "\uD834\uDD1E";
    dom.staffClef.appendChild(clef);

    var clefLabel = document.createElementNS(SVG_NS, "text");
    clefLabel.setAttribute("x", "56");
    clefLabel.setAttribute("y", String(staffY(30) + 40));
    clefLabel.setAttribute("font-size", "13");
    clefLabel.setAttribute("fill", "#8f8270");
    clefLabel.textContent = "Clé de Sol";
    dom.staffClef.appendChild(clefLabel);
  }

  function addStaffEvent(midi) {
    app.staffEvents.push({ midi: midi, ts: performance.now(), dur: null });
    while (app.staffEvents.length > 80) {
      app.staffEvents.shift();
    }
    refreshStaff();
  }

  function groupStaffEvents() {
    var events = app.staffEvents;
    var groups = [];
    var current = [];
    for (var i = 0; i < events.length; i++) {
      if (current.length > 0 && events[i].ts - current[current.length - 1].ts > CHORD_TIMING_MS) {
        groups.push(current);
        current = [];
      }
      current.push(events[i]);
    }
    if (current.length > 0) groups.push(current);

    var total = 0;
    for (var g = groups.length - 1; g >= 0; g--) {
      total += groups[g].length;
      if (total > MAX_STAFF_NOTES) {
        groups.splice(0, g);
        break;
      }
    }
    return groups;
  }

  function refreshStaff() {
    if (!dom.staffNotes) return;
    clearElement(dom.staffNotes);

    var groups = groupStaffEvents();
    var x = 975;
    var xStep = 64;

    for (var gi = groups.length - 1; gi >= 0; gi--) {
      var group = groups[gi];
      var sorted = group.slice().sort(function (a, b) { return a.midi - b.midi; });

      var minDia = midiToDiatonic(sorted[0].midi);
      var maxDia = midiToDiatonic(sorted[sorted.length - 1].midi);
      var stemUp = (minDia + maxDia) / 2 <= 34;
      var ledgerSet = {};

      for (var ni = 0; ni < sorted.length; ni++) {
        var e = sorted[ni];
        var dia = midiToDiatonic(e.midi);
        var y = staffY(dia);
        var struck = noteNames(e.midi).sharp;

        var ledgerY = ledgerDiatonic(dia);
        if (ledgerY !== null && !ledgerSet[ledgerY]) {
          ledgerSet[ledgerY] = true;
          var lx1 = x - 16;
          var lx2 = x + 16;
          if (struck) lx1 -= 14;
          drawLedgerLine(lx1, lx2, staffY(ledgerY));
        }

        if (struck) {
          drawSharp(x - (ni === 0 ? 12 : 12), y);
        }

        drawNoteHead(x, y);

        if (stemUp) {
          drawStem(x + 9, y - 4, x + 9, y - 42);
        } else {
          drawStem(x + 9, y + 4, x + 9, y + 42);
        }
      }
      x -= xStep;
    }
  }

  function staffY(dia) {
    var mid = app.baseOctave * 7 + 6.5;
    return 160 - (dia - mid) * 10;
  }

  /* Retourne la position diatonique d'une ligne ajoutée, ou null */
  function ledgerDiatonic(dia) {
    if (dia < 30) {
      return dia % 2 === 0 ? dia : dia - 1;
    }
    if (dia > 38) {
      return dia % 2 === 0 ? dia : dia + 1;
    }
    return null;
  }

  function drawNoteHead(x, y) {
    var el = document.createElementNS(SVG_NS, "ellipse");
    el.setAttribute("cx", String(x));
    el.setAttribute("cy", String(y));
    el.setAttribute("rx", "9");
    el.setAttribute("ry", "6.5");
    el.setAttribute("transform", "rotate(-20 " + x + " " + y + ")");
    el.setAttribute("fill", "#f6e7cc");
    el.setAttribute("stroke", "#17120f");
    el.setAttribute("stroke-width", "1");
    dom.staffNotes.appendChild(el);
  }

  function drawSharp(x, y) {
    var el = document.createElementNS(SVG_NS, "text");
    el.setAttribute("x", String(x));
    el.setAttribute("y", String(y + 8));
    el.setAttribute("font-size", "22");
    el.setAttribute("fill", "#f0b45f");
    el.setAttribute("font-family", "DejaVu Sans, Segoe UI Symbol, sans-serif");
    el.textContent = "\u266F";
    dom.staffNotes.appendChild(el);
  }

  function drawLedgerLine(x1, x2, y) {
    var el = document.createElementNS(SVG_NS, "line");
    el.setAttribute("x1", String(x1));
    el.setAttribute("y1", String(y));
    el.setAttribute("x2", String(x2));
    el.setAttribute("y2", String(y));
    el.setAttribute("stroke", "#a09178");
    el.setAttribute("stroke-width", "2");
    dom.staffNotes.appendChild(el);
  }

  function drawStem(x1, y1, x2, y2) {
    var el = document.createElementNS(SVG_NS, "line");
    el.setAttribute("x1", String(x1));
    el.setAttribute("y1", String(y1));
    el.setAttribute("x2", String(x2));
    el.setAttribute("y2", String(y2));
    el.setAttribute("stroke", "#f6e7cc");
    el.setAttribute("stroke-width", "2");
    dom.staffNotes.appendChild(el);
  }

  /* ============================================================
   * Enregistrement & lecture
   * ============================================================ */

  function startRecording() {
    if (app.state === "playing") return;
    app.recording.events = [];
    app.recording.startTime = performance.now();
    app.state = "recording";
    refreshRecordUI();
  }

  function recordEvent(midi, velocity, dur) {
    app.recording.events.push({
      midi: midi,
      vel: velocity,
      start: (performance.now() - app.recording.startTime) / 1000,
      dur: dur
    });
    refreshRecordUI();
  }

  function closeRecordingEvent(midi) {
    var now = (performance.now() - app.recording.startTime) / 1000;
    for (var i = app.recording.events.length - 1; i >= 0; i--) {
      var e = app.recording.events[i];
      if (e.midi === midi && e.dur === null) {
        e.dur = clampDur(now - e.start);
        break;
      }
    }
    refreshRecordUI();
  }

  function clampDur(d) {
    return Math.max(0.05, Math.min(8, d));
  }

  function stopRecording() {
    if (app.state !== "recording") return;
    var now = (performance.now() - app.recording.startTime) / 1000;
    for (var i = 0; i < app.recording.events.length; i++) {
      var e = app.recording.events[i];
      if (e.dur === null) {
        e.dur = clampDur(now - e.start);
      }
    }
    app.state = "ready";
    refreshRecordUI();
  }

  function clearRecording() {
    cancelPlayback();
    app.recording.events = [];
    app.recording.startTime = 0;
    app.state = "ready";
    refreshRecordUI();
  }

  function playRecording() {
    if (!app.recording.events.length || app.state === "playing") return;
    if (!ensureAudio()) return;
    app.state = "playing";
    refreshRecordUI();

    var events = app.recording.events;
    for (var i = 0; i < events.length; i++) {
      (function (e) {
        var onTimer = window.setTimeout(function () {
          playKey(e.midi, e.vel || 1);
        }, e.start * 1000);
        var offTimer = window.setTimeout(function () {
          releaseKey(e.midi);
        }, (e.start + (e.dur || 0.2)) * 1000);
        app.playbackTimers.push(onTimer, offTimer);
      })(events[i]);
    }

    var endTime = events.reduce(function (acc, e) {
      return Math.max(acc, e.start + (e.dur || 0.2));
    }, 0);
    app.playbackTimers.push(window.setTimeout(function () {
      if (app.state === "playing") {
        app.state = "ready";
        refreshRecordUI();
      }
    }, endTime * 1000 + 400));
  }

  function cancelPlayback() {
    for (var i = 0; i < app.playbackTimers.length; i++) {
      clearTimeout(app.playbackTimers[i]);
    }
    app.playbackTimers = [];

    for (var k in app.pressedKeys) {
      if (Object.prototype.hasOwnProperty.call(app.pressedKeys, k)) {
        var m = app.pressedKeys[k];
        delete app.pressedKeys[k];
        releaseKey(m);
      }
    }
    if (app.state === "playing") {
      app.state = "ready";
    }
    refreshRecordUI();
  }

  function refreshRecordUI() {
    var recording = app.state === "recording";
    var playing = app.state === "playing";
    var hasEvents = app.recording.events.length > 0;

    dom.recordStart.disabled = recording || playing;
    dom.recordStop.disabled = !recording;
    dom.playBtn.disabled = playing || !hasEvents;
    dom.stopPlayBtn.disabled = !playing;
    dom.clearBtn.disabled = recording || playing || !hasEvents;

    if (recording) {
      dom.recordStatus.textContent = "État : enregistrement…";
    } else if (playing) {
      dom.recordStatus.textContent = "État : lecture…";
    } else {
      dom.recordStatus.textContent = "État : prêt";
    }

    if (hasEvents) {
      var dur = app.recording.events.reduce(function (acc, e) {
        return Math.max(acc, e.start + (e.dur || 0));
      }, 0);
      dom.recordInfo.textContent =
        app.recording.events.length + " note(s) · durée " +
        (Math.round(dur * 100) / 100).toFixed(2) + " s";
    } else {
      dom.recordInfo.textContent = "Aucune note enregistrée.";
    }
  }

  /* ============================================================
   * Options & divers
   * ============================================================ */

  function setShowNames(show) {
    app.showNames = show;
    dom.showNames.checked = show;
    var keys = dom.piano.querySelectorAll(".piano-key");
    for (var i = 0; i < keys.length; i++) {
      keys[i].classList.toggle("hide-label", !show);
    }
  }

  function wireControls() {
    dom.timbreSelect.addEventListener("change", function () {
      app.timbre = dom.timbreSelect.value;
    });

    dom.volumeRange.addEventListener("input", function () {
      setVolume(Number(dom.volumeRange.value) / 100);
    });

    dom.octaveDown.addEventListener("click", function () { changeOctave(-1); });
    dom.octaveUp.addEventListener("click", function () { changeOctave(1); });

    dom.showNames.addEventListener("change", function () {
      setShowNames(dom.showNames.checked);
    });

    dom.panicBtn.addEventListener("click", panic);

    dom.recordStart.addEventListener("click", startRecording);
    dom.recordStop.addEventListener("click", stopRecording);
    dom.playBtn.addEventListener("click", playRecording);
    dom.stopPlayBtn.addEventListener("click", cancelPlayback);
    dom.clearBtn.addEventListener("click", clearRecording);

    dom.helpToggle.addEventListener("click", function () {
      var hidden = dom.helpSection.hidden;
      dom.helpSection.hidden = !hidden;
      dom.helpToggle.setAttribute("aria-expanded", String(hidden));
    });

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        panic();
        cancelPlayback();
      }
    });
    window.addEventListener("blur", panic);

    window.setInterval(function () {
      var now = performance.now();
      for (var k in app.activeVoices) {
        if (!Object.prototype.hasOwnProperty.call(app.activeVoices, k)) continue;
        var v = app.activeVoices[k];
        if (now - v.startedAt > 9500) {
          stopVoice(Number(k), true);
        }
      }
    }, 4000);
  }

  /* ============================================================
   * Initialisation
   * ============================================================ */

  function init() {
    initDom();
    setVolume(0.8);
    dom.octaveValue.textContent = app.baseOctave + "–" + (app.baseOctave + 1);
    dom.octaveDown.disabled = app.baseOctave <= MIN_OCTAVE;
    dom.octaveUp.disabled = app.baseOctave >= MAX_OCTAVE;
    buildPiano();
    buildStaffBackground();
    updateNoteUI(undefined, false);
    refreshRecordUI();
    wireControls();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();