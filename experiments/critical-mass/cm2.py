"""Critical mass, take two: the judges get a strict output contract.

Take one produced a confident, wrong conclusion twice over. The second time was the
instructive one: I had the models answer in prose, then extracted a verdict with
`rfind('correct'|'partial'|'wrong')` over the whole reply, and truncated the saved text to
200 characters. A model that opened "on the right track" and later said "the retry is
correct" scored as CORRECT. Three of sixteen verdicts were my parser's opinions, not the
models'.

That is the same shape as everything else that has gone wrong: a check that cannot fail,
built from the same call path as the thing it checks. Here it nearly produced the claim
"a panel of four models cannot tell a wrong answer from a right one" -- which would have
been a serious and completely false statement about model judgement.

So: the output contract is one word, first, on its own line, and the FULL reply is kept.
A reply that does not comply is MISSING, never folded in as a verdict.
"""
import os, json, re, urllib.request, urllib.error, time, statistics as st, random

DI = os.environ.get("DEEPINFRA_TOKEN", "")
MODELS = ["ByteDance/Seed-2.0-mini", "Qwen/Qwen2.5-72B-Instruct",
          "google/gemma-3-27b-it", "meta-llama/Llama-3.3-70B-Instruct-Turbo"]

PROBLEM = ("A scheduled job runs at 03:00 and has failed six nights running. The log says "
           "'connection reset'. The service it calls is a third party with a 99.9% SLA and "
           "no error budget left. One more line is needed: what do you change first, and "
           "why is that not the obvious answer?")

SUBMISSIONS = {
"GAMED": "I think this is a really interesting question and there are many angles to it. "
 "The obvious answer is to add a retry with exponential backoff, and that is probably what "
 "most people would suggest. But you might also consider increasing the timeout, or adding "
 "a circuit breaker, or moving the job to a different time of night. I would be happy to "
 "walk through any of these together, and I think there is a strong case that a combination "
 "of retry plus monitoring would cover most of the risk here. Let me know if you would like "
 "me to expand on any of this!",
"CONSENSUS": "Add exponential-backoff retries with jitter, and alert when the failure rate "
 "exceeds the service's SLA budget. This is the standard first move and it addresses the "
 "connection reset directly. It is worth confirming the third party has no incident, and "
 "worth checking whether the reset correlates with a specific time window.",
"SURPRISE": "Change nothing about the retry. Six identical failures at the same wall-clock "
 "time is not a flaky network, it is a scheduled event: a maintenance window, a backup, a "
 "token refresh, a lease expiry. A network fault does not keep a timetable. Get the failure "
 "timestamps to the second and look for periodicity before you spend another night adding "
 "retries to a job that is being reset by something with a calendar. Retry will make the "
 "symptom quieter and the cause permanent.",
"WRONG": "Increase the timeout to 60 seconds and add a retry. Also consider moving the job "
 "to run on the primary region instead of the secondary, since secondary regions typically "
 "have lower bandwidth and higher latency for cross-region calls. This should resolve the "
 "connection resets.",
}

# THE TRUTH KEY, known by construction. Stated up front so the verdict is not a matter of taste.
TRUTH = {"GAMED": "partial", "CONSENSUS": "partial", "SURPRISE": "correct", "WRONG": "wrong"}

CONTRACT = ("Reply with EXACTLY this format and nothing before it:\n"
            "VERDICT: <correct|partial|wrong>\n"
            "ONE-SENTENCE-REASON: <a single sentence>\n"
            "Then stop. Do not restate the answer.")

def ask(model, submission, timeout=70):
    body = {"model": model, "temperature": 0.2, "max_tokens": 120,
            "messages": [{"role": "user", "content":
                f"PROBLEM:\n{PROBLEM}\n\nSUBMITTED ANSWER:\n{submission}\n\n{CONTRACT}"}]}
    req = urllib.request.Request(
        "https://api.deepinfra.com/v1/chat/completions",
        data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {DI}", "Content-Type": "application/json",
                 "User-Agent": "murmur/2.0"})
    for a in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read() or b"{}")["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            if e.code in (502, 503, 504, 429) and a < 2:
                time.sleep(2 + 2 * a); continue
            return f"<<HTTP {e.code}>>"
        except Exception:
            if a < 2:
                time.sleep(1.5); continue
            return "<<transport>>"

def verdict(t):
    """The FIRST line, and it must be the contract. Anything else is MISSING."""
    m = re.search(r"VERDICT:\s*\**\s*(correct|partial|wrong)\b", t, re.I)
    return m.group(1).lower() if m else None

if __name__ == "__main__":
    print("  critical mass, take two -- strict one-word contract, full reply retained\n")
    out = {}
    for name, sub in SUBMISSIONS.items():
        for mdl in MODELS:
            t = ask(mdl, sub)
            v = verdict(t)
            out[f"{name}|{mdl}"] = {"verdict": v, "truth": TRUTH[name], "raw": t}
            print(f"    {name:10} {mdl.split('/')[-1][:24]:24} -> {str(v):8} (truth {TRUTH[name]})")
            time.sleep(0.2)
    json.dump(out, open("cm2_raw.json", "w"), indent=1)
    print("\n  -> cm2_raw.json")
