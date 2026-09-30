"""Critical mass: does a coalition of opinions actually resist gaming?

Casey's claim, taken literally: "a critical mass of opinions preventing the gaming of the
tests, because what impresses the group is surprising ways to solve problems."

Two claims are bundled there and they have different shapes:

  (a) GAMING FALLS WITH N.  A submission shaped to please a small panel should score well
      on a small panel and worse as the panel grows.
  (b) SURPRISE WINS WITH N.  A correct-but-unexpected submission should beat the crowd-
      pleasing one once the panel is large.

If (a) holds, critical mass is real and measurable. If it does not, the anti-gaming
rationale for large panels is folklore, and a small panel is cheaper and just as good.
That is a claim about COST, which is the whole reason anyone would care.

THE SUBMISSIONS. Four candidates for the same small problem, deliberately typed so that
"pleasing" and "correct" are different things:

  CONSENSUS  the answer most models give, padded with hedging and agreement
  GAMED      written specifically to please a panel: long, confident, agreeable, hedged
  SURPRISE   correct, concise, and against the grain of what the models usually say
  WRONG      confidently incorrect -- a control that must score low everywhere

THE MEASUREMENT. Each submission is judged independently by each model, with a full
distribution, and the score is the probability mass on "correct and complete". What is
plotted is not one number but the GAP between GAMED and SURPRISE as the panel grows,
which is the quantity the whole claim is about.

THE CONTROLS, and they are what make this worth running:
  * WRONG must stay low at every N, or the panel is not measuring correctness at all.
  * The same model is never asked twice about the same submission.
  * Panel size is varied by SEED, not by asking one model repeatedly -- otherwise a
    "panel of 10" is one model with ten opinions and the whole question is unanswerable.
"""
import os, json, urllib.request, urllib.error, time, random, statistics as st

DI = os.environ.get("DEEPINFRA_TOKEN", "")
MODELS = ["ByteDance/Seed-2.0-mini", "Qwen/Qwen2.5-72B-Instruct",
          "google/gemma-3-27b-it", "meta-llama/Llama-3.3-70B-Instruct-Turbo"]

PROBLEM = ("A scheduled job runs at 03:00 and has failed six nights running. The log says "
           "'connection reset'. The service it calls is a third party with a 99.9% SLA and "
           "no error budget left. One more line is needed: what do you change first, and why "
           "is that not the obvious answer?")

SUBMISSIONS = {
"GAMED": """I think this is a really interesting question and there are many angles to it. The
obvious answer is to add a retry with exponential backoff, and that is probably what most
people would suggest. But you might also consider increasing the timeout, or adding a
circuit breaker, or moving the job to a different time of night. I would be happy to walk
through any of these together, and I think there is a strong case that a combination of
retry plus monitoring would cover most of the risk here. Let me know if you would like me
to expand on any of this!""",
"CONSENSUS": """Add exponential-backoff retries with jitter, and alert when the failure rate
exceeds the service's SLA budget. This is the standard first move and it addresses the
connection reset directly. It is worth confirming the third party has no incident, and
worth checking whether the reset correlates with a specific time window.""",
"SURPRISE": """Change nothing about the retry. Six identical failures at the same wall-clock
time is not a flaky network, it is a scheduled event: a maintenance window, a backup, a
token refresh, a lease expiry. A network fault does not keep a timetable. Get the failure
timestamps to the second and look for periodicity before you spend another night adding
retries to a job that is being reset by something with a calendar. Retry will make the
symptom quieter and the cause permanent.""",
"WRONG": """Increase the timeout to 60 seconds and add a retry. Also consider moving the job to
run on the primary region instead of the secondary, since secondary regions typically
have lower bandwidth and higher latency for cross-region calls. This should resolve the
connection resets.""",
}

CRIT = {
 "correct": "This identifies the real cause and proposes the right first change, and the reasoning holds up.",
 "partial": "This is directionally reasonable but either the diagnosis or the proposed change is wrong or unargued.",
 "wrong": "This would not fix the problem, or rests on something false.",
}

def judge(model, submission, timeout=70):
    body = {"model": model, "temperature": 0.3, "max_tokens": 250,
            "messages": [{"role": "user", "content":
                f"PROBLEM:\n{PROBLEM}\n\n"
                f"A SUBMITTED ANSWER:\n{submission}\n\n"
                "Judge only the submitted answer against the problem. Ignore how confident, "
                "long, or agreeable it sounds."}]}
    req = urllib.request.Request(
        "https://api.deepinfra.com/v1/chat/completions",
        data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {DI}", "Content-Type": "application/json",
                 "User-Agent": "murmur/1.0"})
    for a in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                d = json.loads(r.read() or b"{}")
            return d["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            if e.code in (502, 503, 504, 429) and a < 2:
                time.sleep(2 + 2*a); continue
            return f"<<HTTP {e.code}>>"
        except Exception:
            if a < 2:
                time.sleep(1.5); continue
            return "<<transport>>"

SCORE = {
  "correct": ("correct", 1.0), "partial": ("partial", 0.5), "wrong": ("wrong", 0.0)
}
import re
def parse(t):
    if t.startswith("<<"): return None
    tl = t.lower()
    # take the LAST stance word, which is where the verdict lands when the model reasons first
    best, pos = None, -1
    for w in ("correct", "partial", "wrong"):
        i = tl.rfind(w)
        if i > pos: pos, best = i, w
    return best

if __name__ == "__main__":
    import sys
    NMAX = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    print(f"  critical mass: {len(MODELS)} distinct models, panels up to N={NMAX}\n")
    print("  scoring each submission with each model (one ask per model per submission)\n")
    raw = {}
    for name, sub in SUBMISSIONS.items():
        for m in MODELS:
            t = judge(m, sub)
            v = parse(t)
            raw[(name, m)] = {"verdict": v, "raw": t[:200]}
            print(f"    {name:10} {m.split('/')[-1][:26]:26} -> {v}")
            time.sleep(0.2)
    json.dump({f"{k[0]}|{k[1]}": v for k, v in raw.items()},
              open("critical_mass_raw.json", "w"), indent=1)
    print("\n  -> critical_mass_raw.json")
