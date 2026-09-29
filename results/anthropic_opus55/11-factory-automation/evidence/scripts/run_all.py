"""Regression runner: executes every validation script against the current index.html,
stores raw results in evidence/logs/results.json and prints PASS/FAIL per assertion."""
import json, os, subprocess, sys, time

S = "evidence/scripts/"
ENV = dict(os.environ, PYTHONPATH=S)

def run(name):
    t0 = time.time()
    r = subprocess.run([sys.executable, S + name], capture_output=True, text=True, env=ENV, timeout=900)
    try:
        data = json.loads(r.stdout[r.stdout.index("{"):])
    except Exception:
        data = {"_crash": (r.stdout + r.stderr)[-1500:]}
    data["_seconds"] = round(time.time() - t0, 1)
    return data

C = {
 "t1_build_chain.py": [
   ("extractors placed by clicks", lambda d: d["after_extractors"]["n"] == 2),
   ("belt drag with corner = 12 belts, S then E", lambda d: d["after_belt1"]["belts"] == 12 and "8,11:S" in d["after_belt1"]["dirs"] and "8,12:E" in d["after_belt1"]["dirs"]),
   ("everything powered", lambda d: d["built"]["unpowered"] == 0),
   ("smelter working on delivered ore", lambda d: d["after_12s"]["smelter"]["st"] == "Working"),
   ("power demand = 2x90+90+150 kW", lambda d: d["after_12s"]["power"]["D"] == 420)],
 "t2_pause_step_speed.py": [
   ("pause freezes tick", lambda d: d["pause"]["tick_before"] == d["pause"]["tick_after_1s"]),
   ("'.' and Step button advance exactly 1 tick", lambda d: d["step"]["delta_key"] == 1 and d["step"]["delta_button"] == 1),
   ("1x realtime == pure ticks (hash)", lambda d: d["speed_1x"]["identical"]),
   ("8x realtime == pure ticks (hash)", lambda d: d["speed_8x"]["identical"]),
   ("8x runs ~480 ticks/s", lambda d: d["speed_8x"]["ticks_per_s"] > 400)],
 "t3_logistics.py": [
   ("backpressure cascade after hub deletion", lambda d: d["2_after_backpressure"]["asm"] == "Output blocked" and d["2_after_backpressure"]["smA"] == "Output blocked"),
   ("power demand drops when blocked", lambda d: d["2_after_backpressure"]["powerD"] < d["0_baseline"]["powerD"]),
   ("undo restores hub and flow", lambda d: d["4_flow_resumed"]["delivered"] > d["3_after_undo"]["delivered"]),
   ("R rotates belt, Shift+R rotates back", lambda d: d["6_rotated"]["dir_after_R"] == 1 and d["6_rotated_back"] == 0),
   ("inserter moves gears into chest", lambda d: d["8_inserter_chest"]["chest"]["gears"] > 0),
   ("splitter feeds both smelters", lambda d: d["9_split_merge"]["smelterA_util"] > 0.8 and d["9_split_merge"]["smelterB_util"] > 0.8),
   ("area delete + undo restores contents", lambda d: d["10_area_delete"]["chest"] == 0 and d["11_undo_area_delete"]["chestItems"] > 0)],
 "t4_bottleneck_campaign.py": [
   ("Mk2 upgrade raises plate output", lambda d: d["3_after_fix"]["plateProdPerMin"] > d["1_bottleneck"]["plateProdPerMin"]),
   ("upgrade raises power draw", lambda d: d["3_after_fix"]["smelter"]["kW"] > d["1_bottleneck"]["smelter"]["kW"]),
   ("bottleneck reported", lambda d: any("Bottleneck" in i or "Congestion" in i for i in d["1_bottleneck"]["issues"])),
   ("contract completes with score", lambda d: d["5_complete"]["done"] and d["5_complete"]["score"]["total"] > 0),
   ("next contract loads", lambda d: d["6_next"]["level"] == "c2")],
 "t5_power.py": [
   ("brownout below 100%", lambda d: d["1_brownout"]["sat"] < 1),
   ("crafting speed scales with satisfaction", lambda d: d["2_speed_scaling"]["max_abs_error"] < 1e-9),
   ("removing pole stops machines", lambda d: d["3_pole_removed"]["smelter"] == "No power" and d["3_prog_frozen"]["before"] == d["3_prog_frozen"]["after_10_ticks"]),
   ("hard mode trips breaker", lambda d: d["5_hard_trip"] is not None and d["5_hard_trip"]["trips"] >= 1),
   ("easy mode restores power", lambda d: d["6_easy"]["sat"] == 1)],
 "t6_persistence.py": [
   ("slot save/load exact hash", lambda d: d["4_exact_match"]),
   ("JSON export -> import exact hash", lambda d: d["6_import_matches_saved"]),
   ("garbage import rejected, state kept", lambda d: d["7_malformed"]["garbage.json"]["structs"] == d["7_malformed"]["garbage.json"]["structs_before"]),
   ("no page errors on malformed input", lambda d: d["7_page_errors"] == ""),
   ("share code round trip", lambda d: d["8_share_matches"] and d["8_share_code"]["prefix"] == "FW1."),
   ("PNG export valid", lambda d: d["9_png"]["signature_ok"] and d["9_png"]["width"] > 500)],
 "t7_viewport.py": [
   ("preset keeps producing across resizes", lambda d: d["5_still_producing"]),
   ("no horizontal scroll at 390x844", lambda d: not d["2_layout"]["horizScroll"]),
   ("build on phone layout", lambda d: d["4_phone_build"]["belt"] == "belt"),
   ("HiDPI backing store 2x", lambda d: d["6_hidpi"]["canvas"][0] == 2 * d["6_hidpi"]["css"][0])],
 "t8_touch.py": [
   ("trusted touch pointer events", lambda d: d["1_result"]["pointerTypes"] == ["touch"]),
   ("one-finger belt drag with corner", lambda d: d["1_result"]["belts"] == 11 and d["1_result"]["last"] == "S"),
   ("pinch zoom in", lambda d: d["2_result"]["zoom_after"] > d["2_result"]["zoom_before"]),
   ("second finger cancels build drag", lambda d: d["3_result"]["belts_before"] == d["3_result"]["belts_after"])],
 "t9_editing.py": [
   ("marquee selects 15", lambda d: d["1_marquee"]["selected"] == 15),
   ("paste adds 15 with recipes", lambda d: d["3_paste"]["after"] - d["3_paste"]["before"] == 15),
   ("drag-move + undo", lambda d: d["4_drag_move"]["new"] == "solar" and d["4_undo_move"]["back"] == "solar"),
   ("eyedropper copies recipe", lambda d: d["6_eyedrop"]["recipe"] == "gear" and d["6_eyedrop"]["tool"] == "b:assembler"),
   ("area upgrade + undo", lambda d: d["8_area_upgrade"] == "Mk2,Mk2,Mk2,Mk2,Mk2" and d["8_undo"] == "Mk1,Mk1,Mk1,Mk1,Mk1"),
   ("invalid extractor refused", lambda d: d["9_invalid_extractor"]["placed"] == 0),
   ("wrong recipe starves + jams feed", lambda d: d["10_wrong_recipe"]["status"].startswith("Starved")),
   ("motor needs Mk2", lambda d: d["11_motor_mk1"] == "Needs configuration" and d["11_motor_mk2"]["tier"] == "Mk2"),
   ("speed module changes power", lambda d: d["12_speed_module"]["kW_after"] > d["12_speed_module"]["kW_before"])],
 "t10_perf_overlays_audio.py": [
   ("audio context running after gesture", lambda d: d["1_audio_after_gesture"]["ctx"] == "running" and d["1_audio_after_gesture"]["played"] > 0),
   ("all overlays toggle", lambda d: all(d["2_overlays"].values())),
   ("stress 16x keeps actual speed", lambda d: d["3_stress_16x"]["actualSpeed"] >= 15),
   ("stress >= 30 fps with >2000 items", lambda d: d["3_stress_1x"]["fps"] >= 30 and d["3_stress_1x"]["items"] > 2000),
   ("no network requests", lambda d: "No requests" in d["4_network_requests"]),
   ("no page errors", lambda d: d["4_page_errors"] == "")],
 "t11_settings.py": [
   ("density raises throughput", lambda d: d["6_compressed_drain_density4_belt1"]["measured_per_s"] > d["5_compressed_drain_density3_belt1"]["measured_per_s"]),
   ("belt speed raises throughput", lambda d: d["7_compressed_drain_density3_belt2"]["measured_per_s"] > d["5_compressed_drain_density3_belt1"]["measured_per_s"]),
   ("machine speed doubles output", lambda d: abs(d["5_machine_speed"]["gears_per_min_x2"] - 2 * d["5_machine_speed"]["gears_per_min_x1"]) < 3),
   ("same seed identical, other seed differs", lambda d: d["6_same_seed_identical"] and d["6_diff_seed_differs"]),
   ("grid size honoured", lambda d: d["6_seed777_32x20"]["w"] == 32 and d["6_seed777_64x40_a"]["w"] == 64),
   ("preset rebuild deterministic", lambda d: d["7_preset_hash"][0] == d["7_preset_hash"][1])],
 "t11b_belt_capacity.py": [
   ("density 2/4 free-flow == capacity", lambda d: d["density2"]["free_flow_per_s"] == 3 and d["density4"]["free_flow_per_s"] == 6),
   ("jam packs `density` items per tile", lambda d: d["density3"]["jam_items_per_tile"].startswith("3,3,3") and d["density4"]["jam_items_per_tile"].startswith("4,4,4"))],
 "t12_camera_ui_autosave.py": [
   ("wheel zoom anchored at cursor", lambda d: d["1_wheel_zoom"]["zoomed_in"] and d["1_wheel_zoom"]["cell_under_cursor_before_after"][0] == d["1_wheel_zoom"]["cell_under_cursor_before_after"][1]),
   ("right-drag pans without building", lambda d: d["2_right_drag_pan"]["panned"] and d["2_right_drag_pan"]["structures_unchanged"]),
   ("WASD pans", lambda d: d["3_wasd_pan"]["moved_right"]),
   ("undo/redo buttons", lambda d: d["5_after_undo_button"] is False and d["5_after_redo_button"] is True),
   ("reset restores preset", lambda d: d["5_after_reset"]["chest"] is False),
   ("autosave slot + resume", lambda d: len(d["7_autosave_slot"]) == 1 and d["8_after_resume"]["resumed_from_autosave"])],
 "t13_contract_feasibility.py": [
   ("contract 2 solvable in budget", lambda d: d["c2"]["done"] and d["c2"]["spent"] <= 1500),
   ("contract 3 solvable in budget", lambda d: d["c3"]["done"] and d["c3"]["spent"] <= 2400)],
}

only = sys.argv[1:]
results, summary = {}, []
for name, checks in C.items():
    if only and not any(o in name for o in only):
        continue
    d = run(name)
    results[name] = d
    for label, fn in checks:
        try:
            ok = bool(fn(d))
        except Exception as e:
            ok = False
            label += f"  [error: {e!r}]"
        summary.append((name, label, ok))
        print(("PASS " if ok else "FAIL ") + name + " :: " + label, flush=True)
os.makedirs("evidence/logs", exist_ok=True)
json.dump(results, open("evidence/logs/results.json", "w"), indent=1)
json.dump([{"script": a, "check": b, "pass": c} for a, b, c in summary], open("evidence/logs/summary.json", "w"), indent=1)
print(f"\n{sum(c for _,_,c in summary)}/{len(summary)} checks passed")
