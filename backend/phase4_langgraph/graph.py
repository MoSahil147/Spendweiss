# Phase 4 makes the graph that Phase 2 and 3's create_agent built and ran
# internally, explicit and hand written. Compare this file to Phase 3's
# agent.py: there, one call to create_agent did everything below in one
# line. Here, every node and edge is visible and inspectable, which is
# also what makes graph.get_graph().draw_mermaid() meaningful, there is
# now an actual hand designed shape to draw.
import os
from typing import Annotated

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict

from phase3_memory.tools import check_card_rewards, check_offers, search_past_transactions

load_dotenv()

MODEL = "llama-3.3-70b-versatile"


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


_model = ChatGroq(model=MODEL, api_key=os.environ["GROQ_API_KEY"])
_model_with_tools = _model.bind_tools([check_card_rewards, check_offers])


def retrieve_memory(state: AgentState) -> dict:
    # Runs on every query, unconditionally. This is the Phase 4 change in
    # behaviour from Phase 3: memory retrieval is no longer something the
    # model has to decide to do, it always happens before reasoning starts.
    # The last message may be a plain dict (called directly, as the tests
    # do) or a coerced BaseMessage (when reached via graph.invoke, after
    # LangGraph's add_messages reducer has run), so handle both shapes.
    last_message = state["messages"][-1]
    query = last_message["content"] if isinstance(last_message, dict) else last_message.content
    result = search_past_transactions.invoke({"query": query})
    return {"messages": [{"role": "system", "content": f"Relevant past transactions: {result}"}]}


def reason(state: AgentState) -> dict:
    response = _model_with_tools.invoke(state["messages"])
    return {"messages": [response]}


def respond(state: AgentState) -> dict:
    # A deliberate pass through node, included so the graph has four named
    # nodes matching the original project plan, rather than routing reason
    # straight to END.
    return state


def build_graph():
    builder = StateGraph(AgentState)
    builder.add_node("retrieve_memory", retrieve_memory)
    builder.add_node("reason", reason)
    builder.add_node("call_tool", ToolNode([check_card_rewards, check_offers]))
    builder.add_node("respond", respond)

    builder.add_edge(START, "retrieve_memory")
    builder.add_edge("retrieve_memory", "reason")
    builder.add_conditional_edges("reason", tools_condition, {"tools": "call_tool", "__end__": "respond"})
    builder.add_edge("call_tool", "reason")
    builder.add_edge("respond", END)

    return builder.compile()


graph = build_graph()
