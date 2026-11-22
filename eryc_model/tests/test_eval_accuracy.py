import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from eval_accuracy import score_replies  # noqa: E402


def reply(question, answer, full, b16, b8, b4):
    return {"question": question, "answer": answer, "full": full, "16": b16, "8": b8, "4": b4}


def test_agreement_and_examples():
    output = {
        "full": {"label": "Full precision"}, "16": {"label": "16-bit"},
        "8": {"label": "8-bit"}, "4": {"label": "4-bit"},
        "replies": [
            reply("q1", "red", "Red.", "Red.", "Red.", "A:"),          # only 4-bit changed
            reply("q2", "yes", "No.", "No.", "Yes.", "Yes."),          # 8-bit gained one
            reply("q3", "dog", "Dog.", "Dog.", "Cat.", "Cat."),        # 8-bit lost one
            reply("q4", "2", "2.", "2.", "2.", "2."),                  # nobody changed
        ],
    }
    score_replies(output)
    assert output["agreement"]["16"] == {"same": 4, "lost": 0, "gained": 0}
    assert output["agreement"]["8"] == {"same": 2, "lost": 1, "gained": 1}
    assert output["agreement"]["4"] == {"same": 1, "lost": 2, "gained": 1}
    # 8-bit's score didn't move, and the questions where it changed the answer come first
    assert output["8"]["score"] == output["full"]["score"]
    assert [e["question"] for e in output["examples"]] == ["q2", "q3", "q1"]
