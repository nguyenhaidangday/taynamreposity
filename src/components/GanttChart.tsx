import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Project, ProjectPhase } from '../types';
import { format, differenceInDays, addDays, startOfDay } from 'date-fns';

interface GanttChartProps {
  project: Project;
  phases: ProjectPhase[];
}

export default function GanttChart({ project, phases }: GanttChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || phases.length === 0) return;

    const margin = { top: 40, right: 40, bottom: 40, left: 200 };
    const width = 1000 - margin.left - margin.right;
    const rowHeight = 40;
    const height = (phases.length * rowHeight) + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height)
      .html('') // Clear previous content
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const projectStart = startOfDay(new Date(project.startDate));
    const projectEnd = startOfDay(new Date(project.endDate));
    
    // Extend range slightly for better visibility
    const xMin = addDays(projectStart, -1);
    const xMax = addDays(projectEnd, 1);

    const x = d3.scaleTime()
      .domain([xMin, xMax])
      .range([0, width]);

    const y = d3.scaleBand()
      .domain(phases.map(p => p.id))
      .range([0, phases.length * rowHeight])
      .padding(0.2);

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${phases.length * rowHeight})`)
      .call(d3.axisBottom(x)
        .ticks(d3.timeDay.every(1))
        .tickSize(-phases.length * rowHeight)
        .tickFormat(() => '')
      )
      .style('stroke-dasharray', '3,3')
      .style('stroke-opacity', 0.2);

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${phases.length * rowHeight})`)
      .call(d3.axisBottom(x).ticks(d3.timeDay.every(2)).tickFormat(d => format(d as Date, 'dd/MM') as any));

    // Y Axis
    svg.append('g')
      .call(d3.axisLeft(y).tickFormat(id => {
        const phase = phases.find(p => p.id === id);
        const title = phase?.title || '';
        return title.length > 25 ? title.substring(0, 22) + '...' : title;
      }));

    // Bars
    const bars = svg.selectAll('.bar')
      .data(phases)
      .enter()
      .append('g')
      .attr('class', 'bar');

    bars.append('rect')
      .attr('x', d => x(startOfDay(new Date(d.startDate))))
      .attr('y', d => y(d.id) || 0)
      .attr('width', d => {
        const start = startOfDay(new Date(d.startDate));
        const end = startOfDay(new Date(d.endDate));
        return Math.max(5, x(end) - x(start));
      })
      .attr('height', y.bandwidth())
      .attr('rx', 4)
      .attr('fill', d => {
        switch (d.status) {
          case 'Hoàn thành': return '#22c55e';
          case 'Đang thực hiện': return '#3b82f6';
          case 'Quá hạn': return '#ef4444';
          default: return '#94a3b8';
        }
      });

    // Labels on bars
    bars.append('text')
      .attr('x', d => x(startOfDay(new Date(d.startDate))) + 5)
      .attr('y', d => (y(d.id) || 0) + y.bandwidth() / 2)
      .attr('dy', '.35em')
      .attr('fill', 'white')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text(d => {
        const start = startOfDay(new Date(d.startDate));
        const end = startOfDay(new Date(d.endDate));
        const days = differenceInDays(end, start) + 1;
        return `${days} ngày`;
      });

  }, [phases, project]);

  return (
    <div className="overflow-x-auto bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <svg ref={svgRef}></svg>
    </div>
  );
}
