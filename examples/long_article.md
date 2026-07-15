# Why Schema-Guided Memory Makes Agents More Reliable

## The problem with unstructured memory

Many agent memory systems hand raw text to a language model and let it invent the entities and relationships. The resulting graph often contains generic nodes such as “Topic” and generic edges such as “RELATES_TO”. Information is stored, but precise queries cannot reliably reach it.

Long context alone does not solve the problem. More stored text may increase noise, duplicate facts, and make outdated statements compete with current information. Memory needs a structure that tells the agent what it is allowed to remember.

## Define an ontology before extraction

Pydantic models can define entity types, typed attributes, and descriptions. The extraction model then searches for domain concepts instead of guessing a schema after reading each conversation.

Edge definitions constrain which entity types may connect. A Project can depend on a Library, while a Person can own a Project. Invalid relationships can be rejected before they enter memory.

## Resolve entities and time

Entity resolution merges different mentions of the same real-world object. “OpenAI”, “Open AI”, and a pronoun referring to the company should not create unrelated nodes.

Temporal fields distinguish what used to be true from what is true now. New facts invalidate older facts within a validity window instead of silently overwriting history.

## The result

A schema-guided temporal knowledge graph becomes a queryable model of the domain. The schema is both a storage contract and a reasoning boundary: relationships that cannot be represented cannot be casually hallucinated into the graph.

