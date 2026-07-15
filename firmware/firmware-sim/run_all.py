"""Run ALL cloned firmware-sim instances concurrently in one process.

Usage:
    source .venv/bin/activate
    python run_all.py
"""

from __future__ import annotations

import logging
import threading

from firmware_sim import config
from firmware_sim.simulator import FirmwareSimulator


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    instances = config.list_instances()
    if not instances:
        print("No instances cloned. Run: python -m firmware_sim clone")
        return

    sims: list[FirmwareSimulator] = []
    threads: list[threading.Thread] = []
    for nid in instances:
        cfg = config.load_instance(nid)
        if not cfg:
            continue
        sim = FirmwareSimulator(cfg)
        sims.append(sim)
        t = threading.Thread(target=sim.run, daemon=True)
        t.start()
        threads.append(t)
        print(f"  started {nid} (mac={cfg.mac})")

    print(f"Running {len(sims)} clones. Ctrl+C to stop all.")
    try:
        while True:
            for t in threads:
                t.join(timeout=0.5)
            if not any(t.is_alive() for t in threads):
                break
    except KeyboardInterrupt:
        print("\nStopping all clones...")
        for s in sims:
            s.stop()


if __name__ == "__main__":
    main()
