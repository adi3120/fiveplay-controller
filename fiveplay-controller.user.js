// ==UserScript==
// @name         FivePlay Controller
// @namespace    https://github.com/adi3120/fiveplay-controller
// @version      1.0.0
// @description  Play fiveplay.lol with a game controller in GTA V's original controller layout: each controller button sends the PC key or mouse input the game pairs with it.
// @author       adi3120
// @license      MIT
// @homepageURL  https://github.com/adi3120/fiveplay-controller
// @supportURL   https://github.com/adi3120/fiveplay-controller/issues
// @updateURL    https://raw.githubusercontent.com/adi3120/fiveplay-controller/main/fiveplay-controller.user.js
// @downloadURL  https://raw.githubusercontent.com/adi3120/fiveplay-controller/main/fiveplay-controller.user.js
// @match        https://fiveplay.lol/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
	'use strict';
	if (window.__fivePlayPad) {
		window.__fivePlayPad.toggleHelp();
		return;
	}

	const VERSION = '1.0.0';
	const CFG = {
		lookSpeed: 1000, // right stick at full tilt, in mouse pixels per second; Back + D-pad up/down changes it while playing
		lookCurve: 1.7, // above 1 gives finer aim near the centre of the stick
		invertLookY: false,
		wheelSpeed: 6000, // right stick while the weapon, character or radio wheel is open: a quick flick toward the slot, in pixels per second
		wheelThreshold: 0.4, // and it only moves once the stick is pushed this far
		deadzone: 0.15,
		walkThreshold: 0.45,
		leanThreshold: 0.5, // left stick forward / back while driving leans a bike
		pulseAnalog: true, // partial steering, pitch and roll are pulsed so they act like analog input
		pulsePeriod: 140, // ms
		pulseMin: 45, // ms; the game samples keys once per frame, so shorter pulses could be missed
		triggerOn: 0.35,
		triggerOff: 0.2,
		tapMs: 80, // a tapped key stays down this long, for the same reason
		holdMs: 300, // D-pad down held this long opens the character wheel instead of expanding the radar
		chordMs: 70, // L3 and R3 pressed within this window trigger the special ability
		phoneMs: 5000, // phone controls (D-pad moves, A selects) stay on this long after the last phone button
		pauseMs: 20000, // the same for the pause menu
		backMs: 3000, // after B, which may have closed the phone or the menu
	};

	const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
	const NAME = Object.fromEntries(Object.entries(BTN).map(([k, v]) => [v, k]));

	// Every output is the PC key the game binds to the same action as that controller button (its default bindings), as a
	// KeyboardEvent.code; Mouse0 / Mouse2 are the left / right mouse button and WheelUp / WheelDown one notch of the scroll wheel.
	const MODES = {
		foot: {
			label: 'On foot',
			stick: 'walk',
			triggers: { RT: 'Mouse0', LT: 'Mouse2' },
			buttons: {
				A: 'ShiftLeft', B: 'KeyR', X: 'Space', LB: 'Tab', RB: 'KeyQ', L3: 'ControlLeft', R3: 'KeyC',
				// with the weapon wheel open (LB held) left / right pick the previous / next weapon in the slot
				LEFT: (down) => (down(BTN.LB) ? 'WheelUp' : 'KeyG'),
				RIGHT: (down) => (down(BTN.LB) ? 'WheelDown' : 'KeyE'),
			},
		},
		drive: {
			label: 'Driving',
			stick: 'steer',
			triggers: { RT: 'KeyW', LT: 'KeyS' },
			buttons: {
				A: 'KeyX', B: 'KeyR', X: 'WheelUp', LB: 'Mouse2',
				// RB is the handbrake, and shoots while LB aims
				RB: (down) => (down(BTN.LB) ? 'Mouse0' : 'Space'),
				L3: 'KeyE', R3: 'KeyC', LEFT: 'KeyQ', RIGHT: 'KeyH',
			},
		},
		fly: {
			label: 'Flying',
			stick: 'fly',
			triggers: { RT: 'KeyW', LT: 'KeyS' },
			buttons: {
				A: ['Mouse2', 'ControlLeft'], B: 'KeyR', X: 'ShiftLeft', LB: ['KeyA', 'Numpad7'], RB: ['KeyD', 'Numpad9'],
				L3: 'KeyG', R3: ['Insert', 'KeyC'], LEFT: ['WheelUp', 'KeyQ'], RIGHT: 'KeyE',
			},
		},
	};
	const MODE_ORDER = ['foot', 'drive', 'fly'];
	// added to A and B in every layout: select / back in the phone and menus, and A skips cutscenes
	const ALWAYS = { A: 'Enter', B: 'Backspace' };
	const PHONE = { A: 'Enter', B: 'Backspace', X: 'Space', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' };
	const PAUSE = { ...PHONE, UP: 'ArrowUp', Y: 'Tab', LB: 'KeyQ', RB: 'KeyE' };
	const PAUSE_TRIGGERS = { LT: 'PageDown', RT: 'PageUp' };
	const LOADING = { A: 'Enter', X: 'Space', B: 'Backspace', LEFT: 'Digit5', RIGHT: 'Digit6' };
	// Logitech F310 / F510 / F710 with the switch on the back at D, in case Chrome does not lay its buttons out itself
	const LOGITECH_D = /Vendor:\s*046d\s+Product:\s*c21[689]/i;

	const HELP = {
		foot: [
			'Left stick: move     Right stick: look     L3: stealth     R3: look behind     L3 + R3: special ability',
			'RT: shoot     LT: aim     RB: take cover     LB (hold): weapon wheel, D-pad left / right picks within a slot',
			'A: sprint     X: jump / climb     B: reload / punch     Y: get in a vehicle',
			'D-pad: up phone, down radar (hold: switch character), left detonate / throw, right interact',
		],
		drive: [
			'Left stick: steer, forward / back leans a bike     Right stick: look',
			'RT: accelerate     LT: brake / reverse     RB: handbrake     LB (hold): aim, then RB: shoot',
			'A: duck     B: cinematic camera     X: next vehicle weapon     Y: get out',
			'L3: horn     R3: look behind     L3 + R3: special ability',
			'D-pad: up phone, down radar (hold: switch character), left radio, right headlights',
		],
		fly: [
			'Left stick: pitch and roll     Right stick: look',
			'RT: throttle up     LT: throttle down     LB / RB: turn left / right and switch target',
			'A: fire     B: cinematic camera     Y: get out     L3: landing gear     R3: look behind / attack camera',
			'D-pad: left next weapon / radio, right vertical flight mode     Submarine: X rise, A dive',
		],
		all: [
			'Back: camera view     Start: pause menu     A also skips cutscenes',
			'Phone: D-pad moves, A selects, B goes back. Pause menu: the same, plus LB / RB tabs and LT / RT zoom',
			'Y switches the layout when you get in or out of a vehicle; Back + Y switches it by hand (on foot, driving, flying)',
			'Back + D-pad up / down: look speed     Back + X: FPS counter     Back + A: this help',
			'Logitech F310: keep the switch on the back at D and the Mode light off',
		],
	};

	let savedSpeed = 0;
	try { savedSpeed = +localStorage.getItem('fivePlayPad.lookSpeed'); } catch (e) { /* storage unavailable */ }

	const st = {
		mode: 'foot',
		overlay: null, // 'phone' or 'pause' while those controls are on
		overlayUntil: 0,
		speed: savedSpeed || CFG.lookSpeed,
		cur: [],
		prev: null, // null: take the current buttons as already held (after focus loss), so nothing fires by itself
		latch: new Map(), // button index -> outputs chosen when it was pressed
		pend: new Map(), // L3, R3, DOWN -> press time, while it is not yet known whether they are a combo or a hold
		chord: false,
		backCombo: false,
		trig: { LT: false, RT: false },
		phase: {},
		look: { x: 0, y: 0 },
		lsPushSince: 0,
		held: new Set(),
		taps: new Map(),
		last: 0,
		msg: '',
		msgUntil: 0,
		needClick: false,
		padIndex: -1,
		padSig: new Map(),
		padActive: new Map(),
	};

	const canvas = () => document.getElementById('canvas');
	const locked = () => !!canvas() && document.pointerLockElement === canvas();
	const isMouse = (o) => o === 'Mouse0' || o === 'Mouse2';
	const isWheel = (o) => o === 'WheelUp' || o === 'WheelDown';
	const list = (o) => (o == null ? [] : Array.isArray(o) ? o : [o]);
	const down = (i) => !!st.cur[i];

	function send(o, isDown) {
		if (isMouse(o)) {
			(canvas() || window).dispatchEvent(new MouseEvent(isDown ? 'mousedown' : 'mouseup', { button: +o.slice(5), bubbles: true, cancelable: true }));
		} else {
			window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code: o, key: '', bubbles: true, cancelable: true }));
		}
	}

	const wheel = (o) => window.dispatchEvent(new WheelEvent('wheel', { deltaY: o === 'WheelUp' ? -100 : 100, deltaMode: 0, bubbles: true, cancelable: true }));

	function releaseAll() {
		for (const o of st.held) send(o, false);
		st.held.clear();
		st.taps.clear();
		st.latch.clear();
		st.pend.clear();
		st.chord = false;
		st.backCombo = false;
		st.trig.LT = st.trig.RT = false;
		st.prev = null;
	}

	function latch(i, outputs) {
		const held = [];
		for (const o of list(outputs)) (isWheel(o) ? wheel(o) : held.push(o));
		st.latch.set(i, held);
	}

	function tap(outputs, now) {
		for (const o of list(outputs)) (isWheel(o) ? wheel(o) : st.taps.set(o, now + CFG.tapMs));
	}

	const flash = (msg, now, ms = 2000) => { st.msg = msg; st.msgUntil = now + ms; };

	function outputFor(name) {
		const m = MODES[st.mode].buttons[name];
		return typeof m === 'function' ? m(down) : m;
	}

	function setMode(mode, now) {
		st.mode = mode;
		flash('Controller: ' + MODES[mode].label, now);
		renderHelp();
	}

	function backCombo(name, now) {
		st.backCombo = true;
		if (name === 'Y') setMode(MODE_ORDER[(MODE_ORDER.indexOf(st.mode) + 1) % MODE_ORDER.length], now);
		else if (name === 'UP' || name === 'DOWN') {
			st.speed = Math.round(Math.min(6000, Math.max(150, st.speed * (name === 'UP' ? 1.15 : 1 / 1.15))));
			try { localStorage.setItem('fivePlayPad.lookSpeed', String(st.speed)); } catch (e) { /* storage unavailable */ }
			flash('Look speed: ' + st.speed, now);
		} else if (name === 'X') tap('Equal', now);
		else if (name === 'A') toggleHelp();
	}

	function onPress(name, i, now, layer) {
		if (name !== 'BACK' && down(BTN.BACK)) { backCombo(name, now); latch(i, null); return; }
		if (name === 'BACK') { st.backCombo = false; latch(i, null); return; }
		if (layer === 'loading') { latch(i, LOADING[name]); return; }
		if (name === 'START') {
			st.overlay = layer === 'pause' ? null : 'pause';
			st.overlayUntil = now + CFG.pauseMs;
			latch(i, 'KeyP');
			return;
		}
		const menu = layer === 'pause' ? PAUSE : layer === 'phone' ? PHONE : null;
		if (menu && menu[name]) {
			st.overlayUntil = now + (name === 'B' ? CFG.backMs : layer === 'pause' ? CFG.pauseMs : CFG.phoneMs);
			latch(i, menu[name]);
			return;
		}
		if (name === 'UP') {
			st.overlay = 'phone';
			st.overlayUntil = now + CFG.phoneMs;
			latch(i, 'ArrowUp');
			return;
		}
		if (name === 'L3' || name === 'R3' || name === 'DOWN') { st.pend.set(name, now); return; }
		if (name === 'Y') {
			latch(i, 'KeyF');
			st.overlay = null;
			setMode(st.mode === 'foot' ? 'drive' : 'foot', now);
			return;
		}
		latch(i, [...list(outputFor(name)), ...list(ALWAYS[name])]);
	}

	function onRelease(name, i, now) {
		if (name === 'BACK' && !st.backCombo) tap('KeyV', now);
		if (st.pend.has(name)) {
			st.pend.delete(name);
			tap(name === 'DOWN' ? ['KeyZ', 'ArrowDown'] : outputFor(name), now);
		}
		st.latch.delete(i);
	}

	function resolvePending(now) {
		const l3 = down(BTN.L3), r3 = down(BTN.R3);
		if (l3 && r3 && (st.pend.has('L3') || st.pend.has('R3'))) {
			st.pend.delete('L3');
			st.pend.delete('R3');
			latch(BTN.L3, null);
			latch(BTN.R3, null);
			st.chord = true;
		}
		if (st.chord && !(l3 && r3)) st.chord = false;
		for (const n of ['L3', 'R3']) {
			if (st.pend.has(n) && now - st.pend.get(n) >= CFG.chordMs) { st.pend.delete(n); latch(BTN[n], outputFor(n)); }
		}
		if (st.pend.has('DOWN') && now - st.pend.get('DOWN') >= CFG.holdMs) { st.pend.delete('DOWN'); latch(BTN.DOWN, 'AltLeft'); }
	}

	const shape = (v) => {
		const a = Math.abs(v);
		return a <= CFG.deadzone ? 0 : Math.sign(v) * Math.min(1, (a - CFG.deadzone) / (1 - CFG.deadzone));
	};

	function pulse(id, v, dtMs) {
		if (v <= 0) { st.phase[id] = 0; return false; }
		if (!CFG.pulseAnalog) return v >= 0.5;
		if (v >= 0.97) return true;
		const period = Math.min(500, Math.max(CFG.pulsePeriod, CFG.pulseMin / v, CFG.pulseMin / (1 - v)));
		const p = ((st.phase[id] || 0) + dtMs) % period;
		st.phase[id] = p;
		return p < v * period;
	}

	function axisPulse(want, neg, pos, v, dtMs) {
		if (pulse(list(neg)[0], -v, dtMs)) for (const o of list(neg)) want.add(o);
		if (pulse(list(pos)[0], v, dtMs)) for (const o of list(pos)) want.add(o);
	}

	function stickOutputs(want, ax, dtMs, layer) {
		const x = ax[0] || 0, y = ax[1] || 0;
		const kind = layer === 'pause' ? 'walk' : MODES[st.mode].stick;
		if (kind === 'walk') {
			const r = Math.hypot(x, y);
			if (r < CFG.walkThreshold) return;
			// 0.38 is sin(22.5 deg): eight directions
			if (y / r < -0.38) want.add('KeyW');
			if (y / r > 0.38) want.add('KeyS');
			if (x / r < -0.38) want.add('KeyA');
			if (x / r > 0.38) want.add('KeyD');
		} else if (kind === 'steer') {
			axisPulse(want, 'KeyA', 'KeyD', shape(x), dtMs);
			if (y < -CFG.leanThreshold) want.add('ShiftLeft');
			if (y > CFG.leanThreshold) want.add('ControlLeft');
		} else {
			axisPulse(want, 'Numpad4', 'Numpad6', shape(x), dtMs);
			// the game binds nose up to numpad 5; the page's own I/J/K/L flying aliases use numpad 2, so press both
			axisPulse(want, 'Numpad8', ['Numpad5', 'Numpad2'], shape(y), dtMs);
		}
	}

	function triggerOutputs(want, buttons, layer) {
		for (const t of ['LT', 'RT']) {
			const b = buttons[BTN[t]];
			const v = b ? Math.max(b.value, b.pressed ? 1 : 0) : 0;
			st.trig[t] = st.trig[t] ? v > CFG.triggerOff : v > CFG.triggerOn;
			if (!st.trig[t] || layer === 'loading') continue;
			for (const o of list(layer === 'pause' ? PAUSE_TRIGGERS[t] : MODES[st.mode].triggers[t])) want.add(o);
		}
	}

	function look(ax, dt, layer) {
		const rx = ax[2] || 0, ry = ax[3] || 0, r = Math.hypot(rx, ry);
		const wheelOpen = layer !== 'pause' && (st.held.has('Tab') || st.held.has('AltLeft') || (st.mode !== 'foot' && st.held.has('KeyQ')));
		if (layer === 'loading' || r <= (wheelOpen ? CFG.wheelThreshold : CFG.deadzone)) { st.look.x = st.look.y = 0; return; }
		if (!locked()) { st.needClick = true; st.look.x = st.look.y = 0; return; }
		const amount = wheelOpen
			? CFG.wheelSpeed * dt
			: Math.pow(Math.min(1, (r - CFG.deadzone) / (1 - CFG.deadzone)), CFG.lookCurve) * st.speed * dt;
		st.look.x += (rx / r) * amount;
		st.look.y += (ry / r) * amount * (CFG.invertLookY ? -1 : 1);
		// the page adds movementX/Y into an Int32Array, which would drop fractions: send whole pixels, keep the rest
		const dx = Math.trunc(st.look.x), dy = Math.trunc(st.look.y);
		st.look.x -= dx;
		st.look.y -= dy;
		if (dx || dy) window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true, cancelable: true }));
	}

	function apply(want) {
		const lock = locked();
		st.needClick = false;
		for (const o of [...want]) {
			// without pointer lock the page would treat a click as a request to capture the mouse, which needs a real click
			if (isMouse(o) && !lock) { want.delete(o); st.needClick = true; }
		}
		// the page treats Shift + P as a switch to the engine's debug keyboard mode, so Shift is let go while Start sends P
		if (want.has('KeyP')) { want.delete('ShiftLeft'); want.delete('ShiftRight'); }
		for (const o of [...st.held]) if (!want.has(o)) { send(o, false); st.held.delete(o); }
		for (const o of want) if (!st.held.has(o)) { send(o, true); st.held.add(o); }
	}

	function standardize(p) {
		if (p.mapping === 'standard' || !LOGITECH_D.test(p.id)) return p;
		const b = (i) => p.buttons[i] || { pressed: false, value: 0 };
		const hat = p.axes[9];
		const dir = typeof hat !== 'number' || hat > 1.001 ? -1 : Math.round((hat + 1) * 3.5);
		const dpad = (...dirs) => (dirs.includes(dir) ? { pressed: true, value: 1 } : { pressed: false, value: 0 });
		return {
			id: p.id, index: p.index, connected: true, mapping: 'standard',
			buttons: [b(1), b(2), b(0), b(3), b(4), b(5), b(6), b(7), b(8), b(9), b(10), b(11), dpad(7, 0, 1), dpad(3, 4, 5), dpad(5, 6, 7), dpad(1, 2, 3)],
			axes: [p.axes[0] || 0, p.axes[1] || 0, p.axes[2] || 0, p.axes[5] || 0],
		};
	}

	// The controller in use is the one touched last, so an idle virtual or second pad never takes over; before anything is
	// touched a Logitech pad is preferred, then any pad Chrome recognises.
	function findPad(now) {
		const pads = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter((p) => p && p.connected).map(standardize);
		for (const p of pads) {
			const sig = p.buttons.map((b) => (b && (b.pressed || b.value > 0.5) ? 1 : 0)).join('') + p.axes.slice(0, 4).map((v) => Math.round(v * 3)).join();
			if (st.padSig.has(p.index) && st.padSig.get(p.index) !== sig) st.padActive.set(p.index, now);
			st.padSig.set(p.index, sig);
		}
		const score = (p) => st.padActive.get(p.index) || (/046d|logitech/i.test(p.id) ? -1 : p.mapping === 'standard' ? -2 : -3);
		st.padCount = pads.length;
		return pads.reduce((best, p) => (best && score(best) >= score(p) ? best : p), null);
	}

	function step(now) {
		const dtMs = st.last ? Math.min(50, Math.max(0, now - st.last)) : 0;
		st.last = now;
		const pad = findPad(now);
		if (!pad) {
			if (st.held.size || st.prev) releaseAll();
			st.padIndex = -1;
			status(now, null, 'game');
			return;
		}
		if (pad.index !== st.padIndex) {
			if (st.padIndex !== -1) releaseAll();
			st.padIndex = pad.index;
			if (st.padCount > 1) flash('Using ' + pad.id.split(' (')[0], now, 3000);
		}
		const ld = document.getElementById('loading');
		const loading = !!ld && !ld.classList.contains('done');
		const ax = pad.axes;
		if (st.overlay && now >= st.overlayUntil) st.overlay = null;
		// walking away with the left stick means the phone is put away
		if (st.overlay === 'phone' && st.mode === 'foot' && Math.hypot(ax[0] || 0, ax[1] || 0) > 0.8) {
			if (!st.lsPushSince) st.lsPushSince = now;
			else if (now - st.lsPushSince > 300) st.overlay = null;
		} else st.lsPushSince = 0;
		const layer = loading ? 'loading' : st.overlay || 'game';

		st.cur = pad.buttons.map((b) => !!b && (b.pressed || b.value > 0.5));
		if (st.prev === null) st.prev = st.cur;
		for (let i = 0; i <= BTN.RIGHT; i++) {
			if (i === BTN.LT || i === BTN.RT) continue;
			const was = !!st.prev[i], is = !!st.cur[i];
			if (is && !was) onPress(NAME[i], i, now, layer);
			else if (was && !is) onRelease(NAME[i], i, now);
		}
		st.prev = st.cur;
		resolvePending(now);

		const want = new Set();
		for (const outs of st.latch.values()) for (const o of outs) want.add(o);
		if (st.chord) want.add('CapsLock');
		for (const [o, until] of st.taps) {
			if (now < until) want.add(o);
			else st.taps.delete(o);
		}
		triggerOutputs(want, pad.buttons, layer);
		if (layer !== 'loading') stickOutputs(want, ax, dtMs, layer);
		apply(want);
		look(ax, dtMs / 1000, layer);
		status(now, pad, layer);
	}

	const badge = document.createElement('div');
	badge.style.cssText = 'position:fixed;top:8px;right:8px;z-index:20;max-width:48vw;padding:5px 9px;border-radius:4px;background:rgba(0,0,0,.72);color:#fff;font:12px/1.45 -apple-system,"Segoe UI",sans-serif;white-space:pre-wrap;pointer-events:none;transition:opacity .4s';
	const help = document.createElement('div');
	help.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:21;display:none;max-width:90vw;padding:14px 18px;border-radius:6px;background:rgba(0,0,0,.86);color:#fff;font:13px/1.65 -apple-system,"Segoe UI",sans-serif;white-space:pre-wrap;pointer-events:none';
	const notice = document.createElement('div');
	notice.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:21;display:none;max-width:80vw;padding:12px 20px;border-radius:8px;background:rgba(0,0,0,.85);color:#ffd75e;font:600 17px/1.45 -apple-system,"Segoe UI",sans-serif;text-align:center;pointer-events:none';
	notice.textContent = 'Click inside the game once. Chrome needs a real click before the controller can look around, aim and shoot.';
	document.body.append(badge, help, notice);
	let badgeText = '', badgeSince = 0;

	function status(now, pad, layer) {
		const lines = [];
		if (!canvas()) lines.push('Controller: open fiveplay.lol, then click the bookmark again');
		else if (!pad) lines.push('Controller: connect it, then press any button on it');
		else if (layer === 'loading') lines.push('Controller ready.  A: Story Mode    X: Sandbox Mode (then D-pad left: City map, right: Coast map)');
		else {
			const where = layer === 'pause' ? 'Pause menu (Start closes it)' : MODES[st.mode].label + (layer === 'phone' ? ' + phone (A select, B back)' : '');
			lines.push(now < st.msgUntil ? st.msg : 'Controller: ' + where);
			if (st.needClick) lines.push('Click inside the game once so the controller can look, aim and shoot');
			if (pad.mapping !== 'standard') lines.push('This controller reports an unusual layout, so some buttons may be swapped');
		}
		const showNotice = !!pad && layer !== 'loading' && st.needClick && !!canvas();
		if ((notice.style.display === 'block') !== showNotice) notice.style.display = showNotice ? 'block' : 'none';
		const text = lines.join('\n');
		if (text !== badgeText) {
			badgeText = text;
			badgeSince = now;
			badge.textContent = text;
			badge.style.opacity = '1';
		} else if (pad && layer !== 'loading' && lines.length === 1 && now - badgeSince > 4000 && badge.style.opacity !== '0.35') {
			badge.style.opacity = '0.35';
		}
	}

	function renderHelp() {
		help.textContent = 'FivePlay Controller: ' + MODES[st.mode].label + ' (GTA V controller layout)\n\n' + HELP[st.mode].join('\n') + '\n\n' + HELP.all.join('\n');
	}

	function toggleHelp() {
		renderHelp();
		help.style.display = help.style.display === 'none' ? 'block' : 'none';
	}

	addEventListener('blur', releaseAll);
	addEventListener('gamepadconnected', (e) => flash('Controller connected (' + e.gamepad.id.split(' (')[0] + '). Back + A shows the button layout', performance.now(), 4000));

	let raf = 0;
	const loop = (t) => {
		try { step(t); } catch (e) { console.error('[FivePlay Controller]', e); }
		raf = requestAnimationFrame(loop);
	};
	raf = requestAnimationFrame(loop);
	flash('Controller script v' + VERSION + ' on. Back + A shows the button layout', performance.now(), 5000);

	window.__fivePlayPad = {
		step,
		toggleHelp,
		state: st,
		config: CFG,
		stop() {
			cancelAnimationFrame(raf);
			releaseAll();
			badge.remove();
			help.remove();
			notice.remove();
			delete window.__fivePlayPad;
		},
	};
})();
