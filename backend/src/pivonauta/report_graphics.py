from __future__ import annotations

from collections import defaultdict

from reportlab.lib import colors
from reportlab.platypus import Flowable


class GeometryFigure(Flowable):
    def __init__(self, geometry: dict, primal: dict, integer: dict | None = None):
        super().__init__()
        self.geometry = geometry
        self.primal = primal
        self.integer = integer or {}
        self.width = 685
        self.height = 300

    def draw(self):
        c = self.canv
        viewport = self.geometry["viewport"]
        xmin, xmax = viewport["x_min"], viewport["x_max"]
        ymin, ymax = viewport["y_min"], viewport["y_max"]
        xspan = xmax - xmin
        yspan = ymax - ymin
        if xspan <= 0 or yspan <= 0:
            return
        left, bottom, width, height = 45, 34, 582, 246

        def to_xy(point):
            return (left + (point[0] - xmin) / xspan * width,
                    bottom + (point[1] - ymin) / yspan * height)

        c.saveState()
        c.setStrokeColor(colors.HexColor("#C9D1DB"))
        c.setLineWidth(.7)
        c.rect(left, bottom, width, height, fill=0, stroke=1)
        for index in range(1, 5):
            c.setStrokeColor(colors.HexColor("#E7ECF2"))
            c.line(left + width * index / 5, bottom, left + width * index / 5, bottom + height)
            c.line(left, bottom + height * index / 5, left + width, bottom + height * index / 5)
        polygon = self.geometry.get("polygon") or []
        if len(polygon) >= 3:
            path = c.beginPath()
            first = to_xy(polygon[0])
            path.moveTo(*first)
            for point in polygon[1:]:
                path.lineTo(*to_xy(point))
            path.close()
            c.setFillColor(colors.HexColor("#EEEAFE"))
            c.setStrokeColor(colors.HexColor("#7952C7"))
            c.setLineWidth(1.5)
            c.drawPath(path, stroke=1, fill=1)
        elif len(polygon) == 2:
            c.setStrokeColor(colors.HexColor("#7952C7"))
            c.setLineWidth(3)
            c.line(*to_xy(polygon[0]), *to_xy(polygon[1]))
        for item in self.geometry.get("lines") or []:
            segment = item.get("segment") or []
            if len(segment) != 2:
                continue
            c.setStrokeColor(colors.HexColor("#16A6C1") if item.get("origin") == "constraint"
                             else colors.HexColor("#8697A8"))
            c.setLineWidth(.8)
            c.line(*to_xy(segment[0]), *to_xy(segment[1]))
        for contour in self.geometry.get("level_lines") or []:
            segment = contour.get("segment") or []
            if len(segment) != 2:
                continue
            c.setStrokeColor(colors.HexColor("#D49A32"))
            c.setDash([] if contour.get("optimal") else [3, 4])
            c.setLineWidth(1.4 if contour.get("optimal") else .7)
            c.line(*to_xy(segment[0]), *to_xy(segment[1]))
        c.setDash([])
        for point in (self.geometry.get("integer_lattice") or {}).get("points", [])[:100]:
            x, y = to_xy(point)
            c.setFillColor(colors.HexColor("#778399"))
            c.circle(x, y, 1.5, stroke=0, fill=1)
        face = self.geometry.get("optimal_face") or []
        if len(face) == 2:
            c.setStrokeColor(colors.HexColor("#D49A32"))
            c.setLineWidth(3.3)
            c.line(*to_xy(face[0]), *to_xy(face[1]))
        optimum = self.geometry.get("optimal_point")
        if optimum is not None:
            x, y = to_xy(optimum)
            c.setFillColor(colors.HexColor("#7851BA"))
            c.circle(x, y, 4.7, stroke=0, fill=1)
        values = self.integer.get("variables")
        if values:
            keys = list(values)
            if len(keys) == 2:
                point = [values[key] for key in keys]
                if xmin <= point[0] <= xmax and ymin <= point[1] <= ymax:
                    x, y = to_xy(point)
                    c.setFillColor(colors.HexColor("#148C65"))
                    c.circle(x, y, 5.1, stroke=0, fill=1)
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#415366"))
        for index in range(6):
            xx = xmin + xspan * index / 5
            yy = ymin + yspan * index / 5
            c.drawCentredString(left + width * index / 5, bottom - 15, f"{xx:.4g}")
            c.drawRightString(left - 6, bottom + height * index / 5 - 3, f"{yy:.4g}")
        c.setFont("Helvetica", 8)
        c.drawRightString(left + width, bottom - 28, "x1")
        c.drawString(left - 18, bottom + height + 10, "x2")
        c.restoreState()


class BranchTreeFigure(Flowable):
    def __init__(self, nodes: list[dict]):
        super().__init__()
        self.nodes = nodes[:24]
        self.width = 685
        self.height = 260

    def draw(self):
        if not self.nodes:
            return
        c = self.canv
        levels = defaultdict(list)
        positions = {}
        for node in self.nodes:
            levels[node["depth"]].append(node)
        max_depth = max(levels)
        for depth, layer in levels.items():
            for index, node in enumerate(layer):
                x = (index + 1) * self.width / (len(layer) + 1)
                y = self.height - 28 - depth * (self.height - 55) / max(1, max_depth)
                positions[node["id"]] = (x, y)
        c.saveState()
        c.setStrokeColor(colors.HexColor("#9BAABD"))
        c.setLineWidth(.8)
        for node in self.nodes:
            if node["parent_id"] in positions:
                c.line(*positions[node["parent_id"]], *positions[node["id"]])
        for node in self.nodes:
            x, y = positions[node["id"]]
            status = node["status"]
            fill = "#167F63" if status == "integer" else (
                "#AF7632" if status == "pruned_bound" else (
                    "#A54545" if status == "infeasible" else "#5F579E"
                )
            )
            c.setFillColor(colors.HexColor(fill))
            c.roundRect(x - 31, y - 10, 62, 23, 4, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 7.2)
            label = node["id"]
            if len(label) > 13:
                label = label[:11] + ".."
            c.drawCentredString(x, y + 1, label)
        c.restoreState()
