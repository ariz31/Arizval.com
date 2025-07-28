document.addEventListener('DOMContentLoaded', () => {
    // Data should be defined in a script tag in the HTML itself
    if (typeof mindMapData === 'undefined' || typeof mindMapStructure === 'undefined') {
        console.error("Mind map data not found in this file.");
        return;
    }

    const dom = {
        container: document.getElementById('mind-map-container'),
        viewModal: document.getElementById('view-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalBodyContent: document.getElementById('modal-body-content'),
        closeViewButton: document.getElementById('close-view-button'),
    };

    let simulation, svg, g, linkGroup, nodeGroup, link, node;
    
    function buildHierarchy(nodeId, level) {
        const nodeData = mindMapData[nodeId];
        if (!nodeData) return null;
        const node = { id: nodeId, level: level, data: nodeData };
        const childrenIds = mindMapStructure[nodeId];
        if (childrenIds && childrenIds.length > 0) {
            node.children = childrenIds
                .map(childId => buildHierarchy(childId, level + 1))
                .filter(child => child !== null);
        }
        return node;
    }

    function flattenHierarchy(root) {
        const nodes = [];
        function recurse(node) {
            nodes.push(node);
            if (node.children) {
                node.children.forEach(recurse);
            }
        }
        recurse(root);
        return nodes;
    }

    function updateGraph() {
        const root = buildHierarchy('root', 0);
        if (!root) return;

        const nodes = flattenHierarchy(root);
        const links = d3.hierarchy(root).links();

        const tempSvg = d3.select(document.body).append("svg").attr("class", "temp-svg");
        nodes.forEach(n => {
            const textEl = tempSvg.append("text").text(n.data.title);
            const bbox = textEl.node().getBBox();
            n.width = bbox.width + 40;
            n.height = bbox.height + 20;
        });
        tempSvg.remove();

        node = nodeGroup.selectAll(".node").data(nodes, d => d.id)
            .join("g")
            .attr("class", "node")
            .on("click", handleNodeClick);
        
        node.append("rect")
            .attr("width", d => d.width).attr("height", d => d.height)
            .attr("x", d => -d.width / 2).attr("y", d => -d.height / 2);
            
        node.append("text").text(d => d.data.title);

        link = linkGroup.selectAll(".link").data(links, d => d.target.id)
            .join("path")
            .attr("class", "link");

        simulation.nodes(nodes);
        simulation.force("link").links(links).id(d => d.id);
        simulation.alpha(1).restart();
    }

    function initializeGraph() {
        const width = dom.container.clientWidth;
        const height = dom.container.clientHeight;

        svg = d3.select(dom.container).append("svg").attr("viewBox", [-width / 2, -height / 2, width, height]);
        g = svg.append("g");
        linkGroup = g.append("g");
        nodeGroup = g.append("g");

        simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.id).distance(100).strength(0.5))
            .force("charge", d3.forceManyBody().strength(-400))
            .force("center", d3.forceCenter(0, 0));
        
        simulation.on("tick", () => {
            link.attr("d", d => `M${d.source.x},${d.source.y}C${d.source.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${d.target.y}`);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        svg.call(d3.zoom().scaleExtent([0.1, 4]).on("zoom", e => g.attr("transform", e.transform)));
        updateGraph();
    }

    function handleNodeClick(event, d) {
        event.stopPropagation();
        dom.modalTitle.textContent = d.data.title;
        dom.modalBodyContent.innerHTML = d.data.content;
        dom.viewModal.classList.add('active');
    }

    dom.closeViewButton.addEventListener('click', () => dom.viewModal.classList.remove('active'));
    dom.viewModal.addEventListener('click', (e) => {
        if (e.target === dom.viewModal) {
            dom.viewModal.classList.remove('active');
        }
    });

    initializeGraph();
});
