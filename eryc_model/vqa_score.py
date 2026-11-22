"""Scoring short answers to image questions (no PyTorch needed, so it's easy to test).

VQAv2 answers are short ("yes", "2", "red"). The model's reply is normalized the usual
VQA way (lowercase, no punctuation or articles, number words to digits) and counted as
right when it
  * equals the reference answer, or starts with it ("2 dogs" for "2", "yes it is" for "yes"), or
  * is a short sentence (up to 12 words) that contains the answer as whole words
    ("the object on the right is an umbrella" for "umbrella"). Yes/no answers must start the
    reply, so "is it yes or no" doesn't count as "yes".
"""
import re

NUMBER_WORDS = {
    "none": "0", "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
}
ARTICLES = {"a", "an", "the"}
YES_NO = {"yes", "no"}
MAX_SENTENCE_WORDS = 12
CONTRACTIONS = {"dont": "don't", "doesnt": "doesn't", "isnt": "isn't", "arent": "aren't",
                "cant": "can't", "wont": "won't"}


def normalize(text):
    """'The TWO dogs.' -> '2 dogs'"""
    text = (text or "").strip().lower()
    # keep only the first line / sentence of a longer reply
    text = re.split(r"[\n.!?;]", text)[0]
    text = text.replace("'", "")
    text = re.sub(r"[^\w\s]", " ", text)
    words = []
    for word in text.split():
        if word in ARTICLES:
            continue
        word = NUMBER_WORDS.get(word, word)
        word = CONTRACTIONS.get(word, word)
        words.append(word)
    return " ".join(words)


def is_correct(prediction, answer):
    """True if the normalized prediction equals the answer or starts with it as whole words."""
    p = normalize(prediction)
    a = normalize(answer)
    if not a:
        return False
    if p == a or p.startswith(a + " "):
        return True
    # a short full-sentence reply that contains the answer
    if a not in YES_NO and len(p.split()) <= MAX_SENTENCE_WORDS:
        return (" " + a + " ") in (" " + p + " ")
    return False


def accuracy(predictions, answers):
    """Fraction of predictions that are correct."""
    if len(predictions) == 0:
        return 0.0
    right = 0
    for prediction, answer in zip(predictions, answers):
        if is_correct(prediction, answer):
            right = right + 1
    return right / len(predictions)
