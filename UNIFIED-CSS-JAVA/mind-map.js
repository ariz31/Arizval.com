/* * =============================================
 * Reusable Mind Map Visualization Logic
 * Author: Gemini
 * Version: 5.0 (with Home Popup & Placeholders)
 * =============================================
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Data Validation ---
    if (typeof ROOT_NODE_ID === 'undefined' || typeof mindMapData === 'undefined' || typeof mindMapStructure === 'undefined' || typeof availableMindMaps === 'undefined') {
        console.error("Mind Map Error: One or more required data variables (`ROOT_NODE_ID`, `mindMapData`, `mindMapStructure`, `availableMindMaps`) are not defined.");
        return;
    }

    // --- Global Variables & DOM Selections ---
    const dom = {
        container: document.getElementById('mind-map-container'),
        infoModal: document.getElementById('info-modal'),
        homeModal: document.getElementById('home-modal'),
        themeSwitch: document.getElementById('theme-switch'),
        navLinks: document.querySelectorAll('.nav-link'),
        views: document.querySelectorAll('.view-panel'),
        searchInput: document.getElementById('search-input'),
        searchResultsContent: document.getElementById('search-results-content'),
        listViewContent: document.getElementById('list-view-content'),
        homeModalBody: document.getElementById('home-modal-body'),
        snapshotLink: document.getElementById('snapshot-link'),
        homeLink: document.getElementById('home-link'),
    };
    let simulation, svg, g, linkGroup, nodeGroup, link, node;
    let hierarchyRoot;

    // --- Core Functions ---

    function buildHierarchy(nodeId, level) {
        if (!mindMapData[nodeId]) {
            console.error(`Data for node ID "${nodeId}" is missing.`);
            return null;
        }
        const node = { id: nodeId, level: level };
        const childrenIds = mindMapStructure[nodeId];
        if (childrenIds && childrenIds.length > 0) {
            node._children = childrenIds
                .map(childId => buildHierarchy(childId, level + 1))
                .filter(child => child !== null);
        }
        return node;
    }

    function getVisibleNodesAndLinks(root) {
        const nodes = [];
        const links = [];
        function recurse(node) {
            nodes.push(node);
            if (node.children) {
                node.children.forEach(child => {
                    links.push({ source: node, target: child });
                    recurse(child);
                });
            }
        }
        recurse(root);
        return { nodes, links };
    }

    function updateGraph() {
        if (!hierarchyRoot) return;
        const { nodes: currentNodes, links: currentLinks } = getVisibleNodesAndLinks(hierarchyRoot);
        
        const tempSvg = d3.select(document.body).append("svg").attr("class", "temp-svg");
        currentNodes.forEach(n => {
            const textEl = tempSvg.append("text").attr("class", `node level-${n.level}`).text(mindMapData[n.id].title);
            const bbox = textEl.node().getBBox();
            n.width = bbox.width + (n.level < 2 ? 40 : 30);
            n.height = bbox.height + 20;
        });
        tempSvg.remove();

        node = nodeGroup.selectAll(".node").data(currentNodes, d => d.id)
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
        
        node.attr("class", d => `node level-${d.level} ${d._children && !d.children ? 'collapsed' : ''}`);
        node.select("rect").transition().duration(350).attr("width", d => d.width).attr("height", d => d.height).attr("x", d => -d.width / 2).attr("y", d => -d.height / 2);
        node.select("text").text(d => mindMapData[d.id].title);

        link = linkGroup.selectAll(".link").data(currentLinks, d => `${d.source.id}-${d.target.id}`)
            .join(
                enter => enter.append("line").attr("class", "link").attr("stroke-opacity", 0),
                update => update,
                exit => exit.transition().duration(350).attr("stroke-opacity", 0).remove()
            );
        link.transition().duration(350).attr("stroke-opacity", 1);

        simulation.nodes(currentNodes);
        simulation.force("link").links(currentLinks);
        simulation.alpha(1).restart();
    }

    function initializeGraph() {
        if (!dom.container) return;
        const width = dom.container.clientWidth;
        const height = dom.container.clientHeight;

        d3.select(dom.container).select("svg").remove();
        svg = d3.select(dom.container).append("svg").attr("viewBox", [0, 0, width, height]).attr("id", "mind-map-svg");
        g = svg.append("g");

        linkGroup = g.append("g").attr("class", "links");
        nodeGroup = g.append("g").attr("class", "nodes");

        simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.id).distance(d => (d.source.level + 1) * 70 + 20).strength(0.8))
            .force("charge", d3.forceManyBody().strength(-500).distanceMax(350))
            .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1))
            .force("collide", d3.forceCollide().radius(d => d.width / 2 + 15).strength(1))
            .on("tick", () => {
                link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
                node.attr("transform", d => `translate(${d.x},${d.y})`);
            });

        svg.call(d3.zoom().scaleExtent([0.1, 4]).on("zoom", e => g.attr("transform", e.transform)));
        
        if (hierarchyRoot.children) {
            hierarchyRoot.children.forEach(child => child.children = null);
        }
        updateGraph();
    }
    
    function showModalForNode(nodeId) {
        const data = mindMapData[nodeId];
        if (data && data.content) {
            document.getElementById('modal-title').innerHTML = data.title;
            const modalBody = document.getElementById('modal-body');
            modalBody.innerHTML = data.content;
            modalBody.scrollTop = 0;
            
            if (window.renderMathInElement) {
                renderMathInElement(modalBody, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
            }
            dom.infoModal.classList.add('active');
        }
    }

    function generateListView() {
        function buildList(nodeId) {
            const nodeData = mindMapData[nodeId];
            if (!nodeData) return '';
            
            let html = `<li><div class="list-item" data-id="${nodeId}">${nodeData.title}</div>`;
            const children = mindMapStructure[nodeId];
            if (children && children.length > 0) {
                html += '<ul>';
                children.forEach(childId => {
                    html += buildList(childId);
                });
                html += '</ul>';
            }
            html += '</li>';
            return html;
        }
        const listHtml = `<ul>${buildList(ROOT_NODE_ID)}</ul>`;
        dom.listViewContent.innerHTML = listHtml;
    }

    function populateHomeModal() {
        if (!availableMindMaps || availableMindMaps.length === 0) {
            dom.homeModalBody.innerHTML = '<p>No other mind maps defined.</p>';
            return;
        }
        let html = '<ul class="file-list">';
        availableMindMaps.forEach(map => {
            html += `<li class="file-list-item"><a href="${map.file}"><i class="fas fa-file-alt"></i> ${map.title}</a></li>`;
        });
        html += '</ul>';
        dom.homeModalBody.innerHTML = html;
    }

    // --- Event Handlers ---

    function handleNodeClick(event, d) {
        if (event.defaultPrevented) return;
        const isBranchNode = d._children && d._children.length > 0;
        if (isBranchNode) {
            d.children = d.children ? null : d._children;
            updateGraph();
        } else {
            showModalForNode(d.id);
        }
    }

    function handleViewSwitch(e) {
        e.preventDefault();
        const targetId = e.currentTarget.id.replace('-link', '');
        
        dom.navLinks.forEach(link => link.classList.remove('active'));
        e.currentTarget.classList.add('active');

        dom.views.forEach(view => {
            view.classList.toggle('active', view.id.startsWith(targetId));
        });

        if (targetId !== 'search-results') {
            dom.views.forEach(v => { if(v.id.startsWith('search')) v.classList.remove('active'); });
        }
    }

    function handleSearch() {
        const query = dom.searchInput.value.toLowerCase();
        if (query.length < 2) {
            dom.searchResultsContent.innerHTML = '';
            if(document.getElementById('search-results-container').classList.contains('active')) {
                document.getElementById('mindmap-link').click();
            }
            return;
        }

        const results = Object.keys(mindMapData).filter(id => {
            const node = mindMapData[id];
            return node.title.toLowerCase().includes(query) || node.content.toLowerCase().includes(query);
        });

        let html = '<ul>';
        if (results.length > 0) {
            results.forEach(id => {
                const node = mindMapData[id];
                html += `<li><div class="search-result-item" data-id="${id}"><strong>${node.title}</strong><p>${node.content.substring(0, 100).replace(/<[^>]+>/g, '')}...</p></div></li>`;
            });
        } else {
            html += '<li><div class="search-result-item">No results found.</div></li>';
        }
        html += '</ul>';
        dom.searchResultsContent.innerHTML = html;

        dom.views.forEach(view => view.classList.remove('active'));
        document.getElementById('search-results-container').classList.add('active');
        dom.navLinks.forEach(link => link.classList.remove('active'));
    }

    function handleSnapshot(e) {
        e.preventDefault();
        const svgElement = document.getElementById('mind-map-svg');
        if (!svgElement) return;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
        const url = URL.createObjectURL(svgBlob);

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const { width, height } = svgElement.getBBox();
        canvas.width = width + 40;
        canvas.height = height + 40;

        const img = new Image();
        img.onload = function() {
            context.fillStyle = document.body.classList.contains('dark') ? '#0f172a' : '#f8fafc';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 20, 20);
            URL.revokeObjectURL(url);

            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = 'mind-map-snapshot.png';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        };
        img.src = url;
    }

    function drag(simulation) {
        function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
        function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
        function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    // --- Initial Setup ---
    function init() {
        hierarchyRoot = buildHierarchy(ROOT_NODE_ID, 0);
        initializeGraph();
        generateListView();
        populateHomeModal();

        // Event Listeners
        dom.themeSwitch.addEventListener('change', () => document.body.classList.toggle('dark', dom.themeSwitch.checked));
        document.getElementById('close-info-modal').addEventListener('click', () => dom.infoModal.classList.remove('active'));
        document.getElementById('close-home-modal').addEventListener('click', () => dom.homeModal.classList.remove('active'));
        dom.infoModal.addEventListener('click', (e) => { if (e.target === dom.infoModal) dom.infoModal.classList.remove('active'); });
        dom.homeModal.addEventListener('click', (e) => { if (e.target === dom.homeModal) dom.homeModal.classList.remove('active'); });
        window.addEventListener('resize', initializeGraph);
        
        dom.navLinks.forEach(link => {
            if (link.id !== 'snapshot-link' && link.id !== 'home-link') {
                link.addEventListener('click', handleViewSwitch);
            }
        });
        dom.snapshotLink.addEventListener('click', handleSnapshot);
        dom.homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            dom.homeModal.classList.add('active');
        });
        dom.searchInput.addEventListener('input', handleSearch);

        document.body.addEventListener('click', (e) => {
            const listItem = e.target.closest('.list-item, .search-result-item');
            if (listItem && listItem.dataset.id) {
                showModalForNode(listItem.dataset.id);
            }
        });
    }

    init();
});
