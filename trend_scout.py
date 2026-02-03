import requests
import json
import os
from datetime import datetime, timezone

KEYWORDS = ["AI", "LLM", "GPT", "Agent", "Claude", "OpenAI", "Anthropic", "Nvidia", "Codex"]
OUTPUT_DIR = "/home/ubuntu/.openclaw/workspace/second-brain/content/ideas"

def get_hn_stories(limit=50):
    url = "https://hacker-news.firebaseio.com/v0/topstories.json"
    ids = requests.get(url).json()
    stories = []
    for id in ids[:limit]:
        item = requests.get(f"https://hacker-news.firebaseio.com/v0/item/{id}.json").json()
        if item and "title" in item:
            title = item["title"]
            if any(kw.lower() in title.lower() for kw in KEYWORDS):
                stories.append({
                    "title": title,
                    "url": item.get("url", f"https://news.ycombinator.com/item?id={id}"),
                    "id": id,
                    "score": item.get("score")
                })
    return stories

def save_as_concept_note(story):
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    
    filename = f"Idea-{story['id']}.md"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    content = f"""# Idea: {story['title']}
- **Source:** Hacker News
- **URL:** {story['url']}
- **Fetched:** {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}
- **Score:** {story['score']}

## Initial Thoughts
{story['title']} is currently trending on HN. This could be a good candidate for a Reviewer-style post or a deep-dive in the newsletter.

## Draft Snippet
(To be filled by Ozzy during the drafting phase)
"""
    with open(filepath, "w") as f:
        f.write(content)
    return filename

def main():
    print("🚀 Starting Trend Scout...")
    stories = get_hn_stories(100) # Scan top 100
    new_ideas = []
    for s in stories:
        fname = save_as_concept_note(s)
        new_ideas.append(s['title'])
    
    print(f"✅ Found {len(new_ideas)} new trending AI ideas.")

if __name__ == "__main__":
    main()
