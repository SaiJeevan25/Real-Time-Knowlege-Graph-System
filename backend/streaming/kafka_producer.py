import json
import time
import random
from collections import deque
from datetime import datetime
from kafka import KafkaProducer

# =====================================================
# ELITE NON-REPETITIVE CONTINUOUS PRODUCER
# =====================================================

producer = KafkaProducer(
    bootstrap_servers="localhost:9092",
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
    retries=10,
    linger_ms=5
)

TOPIC = "knowledge-stream-v2"

# =====================================================
# ENTITY POOLS
# =====================================================

companies = [
    "Google", "Microsoft", "Tesla", "Amazon", "Meta", "OpenAI",
    "NVIDIA", "Apple", "Intel", "Samsung", "IBM", "Oracle",
    "Adobe", "SpaceX", "Uber", "Airbnb", "Salesforce", "Spotify"
]

people = [
    "Elon Musk", "Satya Nadella", "Sundar Pichai", "Sam Altman",
    "Mark Zuckerberg", "Tim Cook", "Jensen Huang",
    "Narendra Modi", "Joe Biden", "Emmanuel Macron",
    "Cristiano Ronaldo", "Lionel Messi", "Virat Kohli"
]

countries = [
    "India", "USA", "Germany", "France", "Japan", "Brazil",
    "UAE", "UK", "Canada", "Singapore", "Australia", "China"
]

cities = [
    "Mumbai", "New York", "London", "Dubai", "Tokyo",
    "Paris", "Berlin", "Toronto", "Singapore", "Sydney"
]

universities = [
    "MIT", "Stanford", "Harvard", "Oxford", "Cambridge",
    "IIT Bombay", "IISc Bangalore", "ETH Zurich"
]

sports_teams = [
    "Real Madrid", "Barcelona", "Liverpool",
    "Mumbai Indians", "Chennai Super Kings",
    "Inter Miami", "PSG"
]

products = [
    "AI assistant", "robotics platform", "EV battery",
    "cloud suite", "cybersecurity tool", "AR headset",
    "quantum chip", "satellite system"
]

diseases = [
    "dengue", "malaria", "flu", "covid variant", "cholera"
]

# =====================================================
# EVENT TEMPLATES
# =====================================================

templates = {
    "business": [
        "{company1} acquired {company2} for ${amount} million.",
        "{company1} partnered with {company2} to expand in {country}.",
        "{company1} opened a new office in {city}.",
        "{company1} invested ${amount} million in {company2}.",
        "{company1} signed a logistics deal in {country}."
    ],
    "ai": [
        "{company1} launched a new {product}.",
        "{company1} partnered with {university} on AI research.",
        "{company1} expanded cloud AI services in {country}.",
        "{company1} introduced an enterprise {product}.",
        "{company1} announced next-gen AI chips in {city}."
    ],
    "politics": [
        "{person1} met {person2} in {city}.",
        "{country} signed a trade pact with {country2}.",
        "{person1} announced new reforms in {country}.",
        "{country} hosted a diplomatic summit in {city}.",
        "{person1} visited {country2} for strategic talks."
    ],
    "finance": [
        "{company1} shares rose {percent}% after earnings report.",
        "{company1} announced a ${amount} million buyback.",
        "{country} central bank raised interest rates.",
        "Bitcoin surged above ${amountk}.",
        "{company1} posted record quarterly revenue."
    ],
    "sports": [
        "{team1} signed {person1} for ${amount} million.",
        "{person1} scored twice for {team1}.",
        "{team1} defeated {team2} in {city}.",
        "{person1} won the championship in {country}.",
        "{team1} announced a new coach."
    ],
    "health": [
        "WHO approved a vaccine trial in {country}.",
        "{company1} launched a new healthcare platform.",
        "{country} reported rising {disease} cases.",
        "{company1} announced success in cancer trials.",
        "{hospital} opened a research center in {city}."
    ],
    "cyber": [
        "Hackers targeted a major bank in {country}.",
        "{company1} patched a critical security flaw.",
        "{country} agencies warned of ransomware attacks.",
        "{company1} detected phishing campaigns in {city}.",
        "Interpol arrested cybercrime suspects in {country}."
    ],
    "space": [
        "NASA partnered with {company1} for lunar missions.",
        "{company1} launched a satellite from {city}.",
        "{country} announced a Mars research program.",
        "{company1} tested reusable rocket systems.",
        "ESA signed a space contract with {company1}."
    ],
    "education": [
        "{university} partnered with {company1} on innovation labs.",
        "{university} launched robotics center in {city}.",
        "{country} funded STEM scholarships nationwide.",
        "{university} introduced AI curriculum with {company1}.",
        "{university} received ${amount} million grant."
    ],
    "environment": [
        "{country} launched a solar mission.",
        "{company1} invested in battery recycling.",
        "{country} approved offshore wind expansion.",
        "UN warned of rising temperatures in {country}.",
        "{city} introduced zero-emission transport policy."
    ]
}

# =====================================================
# MEMORY TO AVOID REPEATS
# =====================================================

recent_events = deque(maxlen=200)

# =====================================================
# HELPERS
# =====================================================

def rand_amount():
    return random.randint(50, 5000)

def rand_percent():
    return round(random.uniform(2, 15), 1)

def rand_amountk():
    return random.randint(60000, 150000)

def fill_template(template):
    return template.format(
        company1=random.choice(companies),
        company2=random.choice(companies),
        person1=random.choice(people),
        person2=random.choice(people),
        country=random.choice(countries),
        country2=random.choice(countries),
        city=random.choice(cities),
        university=random.choice(universities),
        team1=random.choice(sports_teams),
        team2=random.choice(sports_teams),
        product=random.choice(products),
        disease=random.choice(diseases),
        hospital="Apollo Hospitals",
        amount=rand_amount(),
        percent=rand_percent(),
        amountk=rand_amountk()
    )

def generate_event():
    for _ in range(20):  # try 20 times to avoid repeats
        category = random.choice(list(templates.keys()))
        template = random.choice(templates[category])
        text = fill_template(template)

        if text not in recent_events:
            recent_events.append(text)

            return {
                "category": category,
                "text": text,
                "timestamp": datetime.utcnow().isoformat()
            }

    # fallback
    return {
        "category": "misc",
        "text": fill_template(random.choice(templates["business"])),
        "timestamp": datetime.utcnow().isoformat()
    }

# =====================================================
# STREAM LOOP
# =====================================================

print("Elite Non-Repetitive Producer Started...\n")

counter = 1

while True:
    try:
        event = generate_event()
        event["id"] = counter

        producer.send(TOPIC, event)
        producer.flush()

        print(f"[{event['category'].upper()}] {event['text']}")

        counter += 1

        # realistic timing
        time.sleep(random.uniform(0.8, 2.2))

    except Exception as e:
        print("Producer error:", e)
        time.sleep(5)