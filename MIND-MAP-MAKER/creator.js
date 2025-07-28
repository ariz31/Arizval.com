// --- Mind Map Data (this will be saved in the downloaded file) ---
let mindMapData = {
    'root': {
        title: 'My First Mind Map',
        content: 'Click a node to select it. Then use the "Add Node" button to add children. Click a node again to edit its content.'
    }
};
let mindMapStructure = {
    'root': []
};

// --- Mind Map Maker Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const dom = {
        container: document.getElementById('mind-map-container'),
        editModal: document.getElementById('edit-modal'),
        modalTitle: document.getElementById('modal-title'),
        nodeTitleInput: document.getElementById('node-title'),
        nodeContentInput: document.getElementById('node-content'),
        addNodeButton: document.getElementById('add-node-button'),
        saveEditButton: document.getElementById('save-edit-button'),
        cancelEditButton: document.getElementById('cancel-edit-button'),
        deleteNodeButton: document.getElementById('delete-node-button'),
        downloadButton: document.getElementById('download-button'),
    };

    let simulation, svg, g, linkGroup, nodeGroup, link, node;
    let selectedNodeId = 'root';
    let editingNodeId = null;

    function generateId() {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

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
            .join(
                enter => {
                    const nodeEnter = enter.append("g").call(drag(simulation)).on("click", handleNodeClick);
                    nodeEnter.append("rect");
                    nodeEnter.append("text");
                    return nodeEnter;
                },
                update => update,
                exit => exit.transition().duration(350).attr("transform", "scale(0)").remove()
            );
        
        node.attr("class", d => `node ${d.id === selectedNodeId ? 'selected' : ''}`);
        node.select("rect").transition().duration(350).attr("width", d => d.width).attr("height", d => d.height).attr("x", d => -d.width / 2).attr("y", d => -d.height / 2);
        node.select("text").text(d => d.data.title);

        link = linkGroup.selectAll(".link").data(links, d => d.target.id)
            .join("path")
            .attr("class", "link")
            .attr("d", d3.linkVertical().x(d => d.x).y(d => d.y));

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
        if (selectedNodeId === d.id) {
            openEditModal(d.id);
        } else {
            selectedNodeId = d.id;
            updateGraph();
        }
    }

    function openEditModal(nodeId) {
        editingNodeId = nodeId;
        const nodeData = mindMapData[nodeId];
        dom.nodeTitleInput.value = nodeData.title;
        dom.nodeContentInput.value = nodeData.content;
        dom.deleteNodeButton.style.display = nodeId === 'root' ? 'none' : 'inline-flex';
        dom.editModal.classList.add('active');
    }

    function closeEditModal() {
        dom.editModal.classList.remove('active');
        editingNodeId = null;
    }

    function saveNode() {
        if (!editingNodeId) return;
        mindMapData[editingNodeId].title = dom.nodeTitleInput.value;
        mindMapData[editingNodeId].content = dom.nodeContentInput.value;
        closeEditModal();
        updateGraph();
    }

    function addNode() {
        if (!selectedNodeId) {
            alert("Please select a parent node first.");
            return;
        }
        const newId = generateId();
        mindMapData[newId] = { title: 'New Node', content: 'Add your description here.' };
        mindMapStructure[newId] = [];
        if (!mindMapStructure[selectedNodeId]) {
            mindMapStructure[selectedNodeId] = [];
        }
        mindMapStructure[selectedNodeId].push(newId);
        selectedNodeId = newId;
        updateGraph();
    }

    function deleteNode() {
        if (!editingNodeId || editingNodeId === 'root') return;
        
        for (const parentId in mindMapStructure) {
            const children = mindMapStructure[parentId];
            const index = children.indexOf(editingNodeId);
            if (index > -1) {
                children.splice(index, 1);
                break;
            }
        }

        const nodesToDelete = [editingNodeId];
        function findDescendants(id) {
            (mindMapStructure[id] || []).forEach(childId => {
                nodesToDelete.push(childId);
                findDescendants(childId);
            });
        }
        findDescendants(editingNodeId);

        nodesToDelete.forEach(id => {
            delete mindMapData[id];
            delete mindMapStructure[id];
        });

        selectedNodeId = 'root';
        closeEditModal();
        updateGraph();
    }

    async function downloadMindMap() {
        try {
            const response = await fetch('mind-map-viewer.html');
            if (!response.ok) {
                alert('Error: Could not fetch the viewer template. Make sure mind-map-viewer.html is in the same directory.');
                return;
            }
            let viewerHTML = await response.text();

            const dataScript = `
    <script>
        const mindMapData = ${JSON.stringify(mindMapData, null, 4)};
        const mindMapStructure = ${JSON.stringify(mindMapStructure, null, 4)};
    <\/script>
            `;

            viewerHTML = viewerHTML.replace(/<title>.*<\/title>/, `<title>${mindMapData.root.title || 'My Mind Map'}</title>`);
            viewerHTML = viewerHTML.replace(/<span class="brand">.*<\/span>/, `<span class="brand">${mindMapData.root.title || 'My Mind Map'}</span>`);
            viewerHTML = viewerHTML.replace(/<script>[\s\S]*?<\/script>/, dataScript);

            const blob = new Blob([viewerHTML], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${mindMapData.root.title.replace(/ /g, '_') || 'mind_map'}.html`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Download failed. Check the console for details.');
        }
    }

    function drag(simulation) {
        function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
        function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
        function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    dom.addNodeButton.addEventListener('click', addNode);
    dom.saveEditButton.addEventListener('click', saveNode);
    dom.cancelEditButton.addEventListener('click', closeEditModal);
    dom.deleteNodeButton.addEventListener('click', deleteNode);
    dom.downloadButton.addEventListener('click', downloadMindMap);
    dom.container.addEventListener('click', () => {
        selectedNodeId = 'root';
        updateGraph();
    });

    initializeGraph();
});
