from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ProposalStatus = Literal["pending", "approved", "rejected"]


class ProposedNode(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    type: Literal["node"] = "node"
    x: int = Field(ge=0)
    y: int = Field(ge=0)

    model_config = ConfigDict(extra="forbid")


class ProposedEdge(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    type: Literal["edge"] = "edge"
    from_node: str = Field(alias="from", min_length=1, max_length=100)
    to_node: str = Field(alias="to", min_length=1, max_length=100)
    walkable: Literal[True] = True

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    @model_validator(mode="after")
    def different_endpoints(self):
        if self.from_node == self.to_node:
            raise ValueError("边的起点和终点不能相同")
        return self


class ProposalChanges(BaseModel):
    add_nodes: list[ProposedNode] = Field(default_factory=list, max_length=200)
    add_edges: list[ProposedEdge] = Field(default_factory=list, max_length=300)
    remove_edge_ids: list[str] = Field(default_factory=list, max_length=300)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def non_empty_and_unique(self):
        if not self.add_nodes and not self.add_edges and not self.remove_edge_ids:
            raise ValueError("申请至少需要包含一项路网修改")
        for values, label in (
            ([node.id for node in self.add_nodes], "新增节点"),
            ([edge.id for edge in self.add_edges], "新增边"),
            (self.remove_edge_ids, "删除边"),
        ):
            if len(values) != len(set(values)):
                raise ValueError(f"{label} ID 不能重复")
        return self


class ProposalCreate(BaseModel):
    area_id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=10, max_length=2000)
    changes: ProposalChanges

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def strip_text(self):
        self.title = self.title.strip()
        self.description = self.description.strip()
        if not self.title or len(self.description) < 10:
            raise ValueError("申请标题和说明不能为空")
        return self


class ProposalPublic(ProposalCreate):
    id: int
    submitter_id: int
    reviewer_id: int | None
    status: ProposalStatus
    review_note: str | None
    merge_summary: str | None
    created_at: datetime
    reviewed_at: datetime | None


class ProposalReview(BaseModel):
    note: str = Field(min_length=2, max_length=2000)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def strip_note(self):
        self.note = self.note.strip()
        if len(self.note) < 2:
            raise ValueError("审核意见不能为空")
        return self
